-- Migration to compute earliest 24h usage availability timestamp whenever 24h usage exists
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

    -- Calculate usage in Monthly window
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

    -- Compute earliest availability timestamp if any 24h usage exists
    IF v_rolling_24h_used > 0 THEN
        SELECT (created_at + INTERVAL '24 hours') INTO v_earliest_avail
        FROM public.ai_usage_events
        WHERE user_id = v_effective_user_id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_24h_start
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF v_r24h_pct_left = 0 THEN
        v_limited_by := 'rolling_24h';
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
            'resetsAt', CASE WHEN v_earliest_avail IS NOT NULL THEN to_char(v_earliest_avail AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ELSE NULL END,
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
