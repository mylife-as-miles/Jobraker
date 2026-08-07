-- Close AI usage settlement state transitions and preserve provider cost independently of billing caps.
CREATE OR REPLACE FUNCTION public.settle_ai_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_input_tokens BIGINT,
    p_output_tokens BIGINT,
    p_billable BOOLEAN DEFAULT true,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_existing RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_input_cost BIGINT;
    v_output_cost BIGINT;
    v_provider_cost BIGINT;
    v_billable_cost BIGINT := 0;

    v_tier TEXT;
    v_monthly_limit BIGINT;
    v_weekly_limit BIGINT;
    v_rolling_24h_limit BIGINT;
    v_period RECORD;
    v_24h_start TIMESTAMPTZ := v_now - INTERVAL '24 hours';
    v_monthly_used BIGINT := 0;
    v_weekly_used BIGINT := 0;
    v_rolling_24h_used BIGINT := 0;
    v_max_allowable_cost BIGINT;
BEGIN
    IF p_input_tokens < 0 OR p_output_tokens < 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'NEGATIVE_TOKEN_INPUT: AI usage settlement requires non-negative token counts';
    END IF;

    -- Lock the request event before inspecting or changing its state.
    SELECT * INTO v_existing
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MISSING_RESERVATION: cannot settle request_id % without a prior reservation', p_request_id;
    END IF;

    v_input_cost := p_input_tokens * 500;
    v_output_cost := p_output_tokens * 3000;
    v_provider_cost := v_input_cost + v_output_cost;

    -- The only safe duplicate is an exact replay of a completed billable settlement.
    IF v_existing.status = 'settled' THEN
        IF v_existing.input_tokens = p_input_tokens
           AND v_existing.output_tokens = p_output_tokens
           AND v_existing.billable IS NOT DISTINCT FROM p_billable THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'request_id', p_request_id,
                'provider_cost_nanos', v_existing.provider_cost_nanos,
                'billable_cost_nanos', v_existing.billable_cost_nanos,
                'status', v_existing.status
            );
        END IF;

        RAISE EXCEPTION
            'SETTLEMENT_IDEMPOTENCY_MISMATCH: request_id % was already settled with different token totals or billable state',
            p_request_id;
    END IF;

    IF v_existing.status <> 'reserved' THEN
        RAISE EXCEPTION 'RESERVATION_NOT_SETTLEABLE: request_id % is in % state', p_request_id, v_existing.status;
    END IF;

    IF v_existing.reservation_expires_at IS NULL
       OR v_existing.reservation_expires_at <= v_now THEN
        RAISE EXCEPTION 'EXPIRED_RESERVATION: request_id % can no longer be settled', p_request_id;
    END IF;

    IF p_billable THEN
        -- Reserve and settle serialize on the user profile lock, so the allowance re-check is race-free.
        PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

        v_tier := public.get_user_tier(p_user_id);
        SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
        INTO v_monthly_limit, v_weekly_limit, v_rolling_24h_limit
        FROM public.get_ai_tier_limits(v_tier);

        SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

        SELECT COALESCE(SUM(
            CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
        ), 0) INTO v_monthly_used
        FROM public.ai_usage_events
        WHERE user_id = p_user_id
          AND id <> v_existing.id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_period.current_period_start
          AND created_at < v_period.current_period_end;

        SELECT COALESCE(SUM(
            CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
        ), 0) INTO v_weekly_used
        FROM public.ai_usage_events
        WHERE user_id = p_user_id
          AND id <> v_existing.id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_period.weekly_window_start
          AND created_at < v_period.weekly_window_end;

        SELECT COALESCE(SUM(
            CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
        ), 0) INTO v_rolling_24h_used
        FROM public.ai_usage_events
        WHERE user_id = p_user_id
          AND id <> v_existing.id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_24h_start;

        v_max_allowable_cost := LEAST(
            GREATEST(0, v_monthly_limit - v_monthly_used),
            GREATEST(0, v_weekly_limit - v_weekly_used),
            GREATEST(0, v_rolling_24h_limit - v_rolling_24h_used)
        );
        v_billable_cost := LEAST(v_provider_cost, v_max_allowable_cost);
    END IF;

    UPDATE public.ai_usage_events
    SET
        input_tokens = p_input_tokens,
        output_tokens = p_output_tokens,
        total_tokens = p_input_tokens + p_output_tokens,
        input_cost_nanos = v_input_cost,
        output_cost_nanos = v_output_cost,
        provider_cost_nanos = v_provider_cost,
        billable_cost_nanos = v_billable_cost,
        total_cost_nanos = v_billable_cost,
        billable = p_billable,
        status = CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
        metadata = v_existing.metadata || p_metadata || jsonb_build_object(
            'provider_cost_nanos', v_provider_cost,
            'billable_cost_nanos', v_billable_cost,
            'billing_capped', p_billable AND v_billable_cost < v_provider_cost
        ),
        settled_at = v_now,
        reservation_expires_at = NULL
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'provider_cost_nanos', v_provider_cost,
        'billable_cost_nanos', v_billable_cost,
        'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) TO service_role;
