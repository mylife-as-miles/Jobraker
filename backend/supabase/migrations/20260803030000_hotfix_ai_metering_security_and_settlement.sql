-- Migration: Hotfix AI Metering Security & Settlement Over-reservation Limit Safety

-- 1. Security Fix: Revoke get_ai_tier_limits from authenticated & PUBLIC users (service_role ONLY)
REVOKE ALL ON FUNCTION public.get_ai_tier_limits(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_tier_limits(text) TO service_role;

-- 2. Settlement Fix: Add row locks and window re-checks if actual cost > reserved cost
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
    v_total_cost BIGINT;
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
    v_clamped_cost BIGINT;
BEGIN
    SELECT * INTO v_existing FROM public.ai_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

    -- Calculate exact costs in nanodollars (Input: 500 nanos/token, Output: 3000 nanos/token)
    v_input_cost := GREATEST(0, p_input_tokens) * 500;
    v_output_cost := GREATEST(0, p_output_tokens) * 3000;
    v_total_cost := v_input_cost + v_output_cost;

    IF v_existing.id IS NULL THEN
        -- Insert new settled record if no reservation existed
        INSERT INTO public.ai_usage_events (
            user_id,
            request_id,
            feature_key,
            provider,
            model,
            input_tokens,
            output_tokens,
            total_tokens,
            input_cost_nanos,
            output_cost_nanos,
            total_cost_nanos,
            reserved_cost_nanos,
            billable,
            status,
            metadata,
            settled_at,
            created_at
        ) VALUES (
            p_user_id,
            p_request_id,
            'general_ai',
            'gemini',
            'gemini-3-flash-preview',
            p_input_tokens,
            p_output_tokens,
            p_input_tokens + p_output_tokens,
            v_input_cost,
            v_output_cost,
            v_total_cost,
            v_total_cost,
            p_billable,
            CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
            p_metadata,
            v_now,
            v_now
        );

        RETURN jsonb_build_object(
            'success', true,
            'settled_cost_nanos', v_total_cost,
            'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END
        );
    END IF;

    v_clamped_cost := v_total_cost;

    -- If actual cost exceeds reserved cost, re-check windows with row lock
    IF p_billable AND v_total_cost > v_existing.reserved_cost_nanos THEN
        PERFORM id FROM public.profiles WHERE id = p_user_id FOR UPDATE;

        v_tier := public.get_user_tier(p_user_id);
        SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
        INTO v_monthly_limit, v_weekly_limit, v_rolling_24h_limit
        FROM public.get_ai_tier_limits(v_tier);

        SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

        -- Exclude current request's reserved amount from usage sum
        SELECT COALESCE(SUM(
            CASE WHEN status = 'settled' THEN total_cost_nanos ELSE reserved_cost_nanos END
        ), 0) INTO v_monthly_used
        FROM public.ai_usage_events
        WHERE user_id = p_user_id
          AND id <> v_existing.id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_period.current_period_start
          AND created_at < v_period.current_period_end;

        SELECT COALESCE(SUM(
            CASE WHEN status = 'settled' THEN total_cost_nanos ELSE reserved_cost_nanos END
        ), 0) INTO v_weekly_used
        FROM public.ai_usage_events
        WHERE user_id = p_user_id
          AND id <> v_existing.id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_period.weekly_window_start
          AND created_at < v_period.weekly_window_end;

        SELECT COALESCE(SUM(
            CASE WHEN status = 'settled' THEN total_cost_nanos ELSE reserved_cost_nanos END
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

        -- Clamp overage if it exceeds available limit
        IF v_total_cost > v_max_allowable_cost THEN
            v_clamped_cost := GREATEST(v_existing.reserved_cost_nanos, v_max_allowable_cost);
        END IF;
    END IF;

    UPDATE public.ai_usage_events
    SET
        input_tokens = GREATEST(0, p_input_tokens),
        output_tokens = GREATEST(0, p_output_tokens),
        total_tokens = GREATEST(0, p_input_tokens + p_output_tokens),
        input_cost_nanos = v_input_cost,
        output_cost_nanos = v_output_cost,
        total_cost_nanos = v_clamped_cost,
        billable = p_billable,
        status = CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
        metadata = v_existing.metadata || p_metadata || jsonb_build_object(
            'raw_cost_nanos', v_total_cost,
            'overage_clamped', v_clamped_cost < v_total_cost
        ),
        settled_at = v_now,
        reservation_expires_at = NULL
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'settled_cost_nanos', v_clamped_cost,
        'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
