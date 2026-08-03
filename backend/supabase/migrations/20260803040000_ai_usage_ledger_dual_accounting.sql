-- Migration: Dual Accounting AI Usage Ledger (provider_cost_nanos vs billable_cost_nanos) & Closed Settlement

-- 1. Add dual accounting cost columns to public.ai_usage_events
ALTER TABLE public.ai_usage_events
    ADD COLUMN IF NOT EXISTS provider_cost_nanos BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billable_cost_nanos BIGINT NOT NULL DEFAULT 0;

-- 2. Security Fix: Revoke get_ai_tier_limits from authenticated & PUBLIC users (service_role ONLY)
REVOKE ALL ON FUNCTION public.get_ai_tier_limits(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_tier_limits(text) TO service_role;

-- 3. Fail-Closed & Dual Accounting Settle RPC
CREATE OR REPLACE FUNCTION public.settle_ai_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_input_tokens BIGINT,
    p_output_tokens BIGINT,
    p_billable BOOLEAN DEFAULT true,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_input_cost BIGINT;
    v_output_cost BIGINT;
    v_provider_cost BIGINT;
    v_billable_cost BIGINT;
    v_existing RECORD;
    v_now TIMESTAMPTZ := NOW();

    v_tier TEXT;
    v_monthly_limit BIGINT;
    v_weekly_limit BIGINT;
    v_rolling_24h_limit BIGINT;
    v_period RECORD;
    v_24h_start TIMESTAMPTZ := v_now - INTERVAL '24 hours';

    v_monthly_used BIGINT := 0;
    v_weekly_used BIGINT := 0;
    v_rolling_24h_used BIGINT := 0;

    v_monthly_avail BIGINT;
    v_weekly_avail BIGINT;
    v_rolling_24h_avail BIGINT;

    v_max_allowable_cost BIGINT;
    v_overage_detected BOOLEAN := false;
BEGIN
    SELECT * INTO v_existing FROM public.ai_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

    -- Mandatory Correction: Missing reservation fails closed!
    IF v_existing.id IS NULL THEN
        RAISE EXCEPTION 'MISSING_RESERVATION: Cannot settle AI usage without a valid prior reservation event for request_id %', p_request_id;
    END IF;

    -- Exact provider cost in nanodollars (Input: 500 nanos/token, Output: 3000 nanos/token)
    v_input_cost := GREATEST(0, p_input_tokens) * 500;
    v_output_cost := GREATEST(0, p_output_tokens) * 3000;
    v_provider_cost := v_input_cost + v_output_cost;
    v_billable_cost := CASE WHEN p_billable THEN v_provider_cost ELSE 0 END;

    IF v_provider_cost > v_existing.reserved_cost_nanos THEN
        v_overage_detected := true;
    END IF;

    -- If billable overage occurred, lock user profile and re-check windows
    IF p_billable AND v_overage_detected THEN
        PERFORM id FROM public.profiles WHERE id = p_user_id FOR UPDATE;

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

        v_monthly_avail := GREATEST(0, v_monthly_limit - v_monthly_used);
        v_weekly_avail := GREATEST(0, v_weekly_limit - v_weekly_used);
        v_rolling_24h_avail := GREATEST(0, v_rolling_24h_limit - v_rolling_24h_used);

        v_max_allowable_cost := LEAST(v_monthly_avail, v_weekly_avail, v_rolling_24h_avail);

        IF v_billable_cost > v_max_allowable_cost THEN
            v_billable_cost := GREATEST(v_existing.reserved_cost_nanos, v_max_allowable_cost);
        END IF;
    END IF;

    UPDATE public.ai_usage_events
    SET
        input_tokens = GREATEST(0, p_input_tokens),
        output_tokens = GREATEST(0, p_output_tokens),
        total_tokens = GREATEST(0, p_input_tokens + p_output_tokens),
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
            'overage_detected', v_overage_detected
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


-- 4. Update get_ai_usage_status to sum billable_cost_nanos
CREATE OR REPLACE FUNCTION public.get_ai_usage_status(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB AS $$
DECLARE
    v_effective_user_id UUID;
    v_tier TEXT;
    v_monthly_limit BIGINT;
    v_weekly_limit BIGINT;
    v_rolling_24h_limit BIGINT;
    v_period RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_24h_start TIMESTAMPTZ := v_now - INTERVAL '24 hours';

    v_monthly_used BIGINT := 0;
    v_weekly_used BIGINT := 0;
    v_rolling_24h_used BIGINT := 0;

    v_r24h_pct_used INT;
    v_r24h_pct_left INT;
    
    v_weekly_pct_used INT;
    v_weekly_pct_left INT;

    v_monthly_pct_used INT;
    v_monthly_pct_left INT;

    v_limited_by TEXT := NULL;
    v_earliest_avail TIMESTAMPTZ := NULL;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated call to get_ai_usage_status';
    END IF;

    v_tier := public.get_user_tier(v_effective_user_id);

    SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
    INTO v_monthly_limit, v_weekly_limit, v_rolling_24h_limit
    FROM public.get_ai_tier_limits(v_tier);

    SELECT * INTO v_period FROM public.get_user_billing_period(v_effective_user_id);

    -- Calculate usage in Monthly window (summing billable_cost_nanos)
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_monthly_used
    FROM public.ai_usage_events
    WHERE user_id = v_effective_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    -- Calculate usage in Weekly window
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_weekly_used
    FROM public.ai_usage_events
    WHERE user_id = v_effective_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    -- Calculate usage in Rolling 24h window
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_rolling_24h_used
    FROM public.ai_usage_events
    WHERE user_id = v_effective_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_24h_start;

    v_r24h_pct_used := LEAST(100, GREATEST(0, ROUND((v_rolling_24h_used::NUMERIC / GREATEST(1, v_rolling_24h_limit)::NUMERIC) * 100))::INT);
    v_r24h_pct_left := 100 - v_r24h_pct_used;

    v_weekly_pct_used := LEAST(100, GREATEST(0, ROUND((v_weekly_used::NUMERIC / GREATEST(1, v_weekly_limit)::NUMERIC) * 100))::INT);
    v_weekly_pct_left := 100 - v_weekly_pct_used;

    v_monthly_pct_used := LEAST(100, GREATEST(0, ROUND((v_monthly_used::NUMERIC / GREATEST(1, v_monthly_limit)::NUMERIC) * 100))::INT);
    v_monthly_pct_left := 100 - v_monthly_pct_used;

    IF v_r24h_pct_left = 0 THEN
        v_limited_by := 'rolling_24h';
        SELECT (created_at + INTERVAL '24 hours') INTO v_earliest_avail
        FROM public.ai_usage_events
        WHERE user_id = v_effective_user_id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_24h_start
        ORDER BY created_at ASC
        LIMIT 1;
    ELSIF v_weekly_pct_left = 0 THEN
        v_limited_by := 'weekly';
    ELSIF v_monthly_pct_left = 0 THEN
        v_limited_by := 'monthly';
    END IF;

    RETURN jsonb_build_object(
        'plan', public.normalize_tier(v_tier),
        'rolling24h', jsonb_build_object(
            'percentUsed', v_r24h_pct_used,
            'percentLeft', v_r24h_pct_left,
            'resetsAt', NULL,
            'resetsGradually', true,
            'nextAvailabilityAt', CASE WHEN v_earliest_avail IS NOT NULL THEN to_char(v_earliest_avail AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ELSE NULL END
        ),
        'weekly', jsonb_build_object(
            'percentUsed', v_weekly_pct_used,
            'percentLeft', v_weekly_pct_left,
            'resetsAt', to_char(v_period.weekly_window_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'resetsGradually', false
        ),
        'monthly', jsonb_build_object(
            'percentUsed', v_monthly_pct_used,
            'percentLeft', v_monthly_pct_left,
            'resetsAt', to_char(v_period.current_period_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'resetsGradually', false
        ),
        'limitedBy', v_limited_by
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
