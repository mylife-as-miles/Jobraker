-- Migration: Update AI Usage Ledger Schema, Security, and Expired Reservation Handling

DROP FUNCTION IF EXISTS public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, jsonb);
DROP FUNCTION IF EXISTS public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, text, jsonb);

-- 1. Alter public.ai_usage_events to add new mandatory fields
ALTER TABLE public.ai_usage_events
    ADD COLUMN IF NOT EXISTS reserved_cost_nanos BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS payload_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_hash ON public.ai_usage_events(user_id, feature_key, payload_hash) WHERE payload_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_status_expires ON public.ai_usage_events(user_id, status, reservation_expires_at) WHERE status = 'reserved';

-- 2. Update public.get_ai_tier_limits to include explicit Free Plan allowances
CREATE OR REPLACE FUNCTION public.get_ai_tier_limits(p_tier TEXT)
RETURNS TABLE (
    monthly_allowance_nanos BIGINT,
    weekly_allowance_nanos BIGINT,
    rolling_24h_allowance_nanos BIGINT
) AS $$
DECLARE
    v_norm TEXT;
BEGIN
    v_norm := public.normalize_tier(p_tier);
    CASE v_norm
        WHEN 'Starter' THEN
            monthly_allowance_nanos := 3000000000;    -- $3.00
            weekly_allowance_nanos := 1200000000;     -- $1.20
            rolling_24h_allowance_nanos := 300000000;  -- $0.30
        WHEN 'Basics' THEN
            monthly_allowance_nanos := 5000000000;    -- $5.00
            weekly_allowance_nanos := 2000000000;     -- $2.00
            rolling_24h_allowance_nanos := 500000000;  -- $0.50
        WHEN 'Pro' THEN
            monthly_allowance_nanos := 12000000000;   -- $12.00
            weekly_allowance_nanos := 4800000000;    -- $4.80
            rolling_24h_allowance_nanos := 1200000000; -- $1.20
        WHEN 'Ultimate' THEN
            monthly_allowance_nanos := 25000000000;   -- $25.00
            weekly_allowance_nanos := 10000000000;   -- $10.00
            rolling_24h_allowance_nanos := 2500000000; -- $2.50
        ELSE
            -- Explicit Free Plan Allowance ($0.50 Monthly, $0.20 Weekly, $0.05 Rolling 24h)
            monthly_allowance_nanos := 500000000;     -- $0.50
            weekly_allowance_nanos := 200000000;      -- $0.20
            rolling_24h_allowance_nanos := 50000000;   -- $0.05
    END CASE;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Update public.get_user_billing_period to truncate weekly window at current_period_end
CREATE OR REPLACE FUNCTION public.get_user_billing_period(p_user_id UUID)
RETURNS TABLE (
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    weekly_window_start TIMESTAMPTZ,
    weekly_window_end TIMESTAMPTZ
) AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_weeks_passed INT;
    v_w_start TIMESTAMPTZ;
    v_w_end TIMESTAMPTZ;
BEGIN
    SELECT us.current_period_start, us.current_period_end
    INTO v_start, v_end
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND us.current_period_end > v_now
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF v_start IS NULL THEN
        -- Fallback: Deterministic UTC calendar month
        v_start := date_trunc('month', v_now);
        v_end := v_start + INTERVAL '1 month';
    END IF;

    -- Weekly window aligned to billing period start
    IF v_now < v_start THEN
        v_w_start := v_start;
        v_w_end := LEAST(v_end, v_start + INTERVAL '7 days');
    ELSE
        v_weeks_passed := FLOOR(EXTRACT(EPOCH FROM (v_now - v_start)) / (7 * 86400));
        v_w_start := v_start + (v_weeks_passed * INTERVAL '7 days');
        -- Mandatory Correction: Truncate weekly window end at current_period_end
        v_w_end := LEAST(v_end, v_w_start + INTERVAL '7 days');
    END IF;

    current_period_start := v_start;
    current_period_end := v_end;
    weekly_window_start := v_w_start;
    weekly_window_end := v_w_end;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Override reserve_ai_usage with security search_path, payload_hash, and 5-min TTL expiry
CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_feature_key TEXT,
    p_provider TEXT,
    p_model TEXT,
    p_estimated_cost_nanos BIGINT,
    p_parent_request_id UUID DEFAULT NULL,
    p_payload_hash TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_existing RECORD;
    v_tier TEXT;
    v_monthly_limit BIGINT;
    v_weekly_limit BIGINT;
    v_rolling_24h_limit BIGINT;
    v_period RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_24h_start TIMESTAMPTZ := v_now - INTERVAL '24 hours';
    v_expires_at TIMESTAMPTZ := v_now + INTERVAL '5 minutes';
    
    v_monthly_used BIGINT := 0;
    v_weekly_used BIGINT := 0;
    v_rolling_24h_used BIGINT := 0;
    
    v_monthly_avail BIGINT;
    v_weekly_avail BIGINT;
    v_rolling_24h_avail BIGINT;
BEGIN
    -- Idempotency check: if request_id already exists, return existing status
    SELECT * INTO v_existing FROM public.ai_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

    IF v_existing.id IS NOT NULL THEN
        -- Reject reuse if feature_key or payload_hash differs
        IF v_existing.feature_key <> p_feature_key OR (p_payload_hash IS NOT NULL AND v_existing.payload_hash <> p_payload_hash) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_REQUEST_ID_REUSE',
                'message', 'Request ID cannot be reused across different features or payloads.'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'status', v_existing.status,
            'request_id', p_request_id
        );
    END IF;

    -- Row lock on user profile to serialize concurrent AI requests for this user
    PERFORM id FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    -- Resolve user tier & allowance limits
    v_tier := public.get_user_tier(p_user_id);
    SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
    INTO v_monthly_limit, v_weekly_limit, v_rolling_24h_limit
    FROM public.get_ai_tier_limits(v_tier);

    -- Resolve billing windows
    SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

    -- Calculate usage in Monthly window (settled + active unexpired reservations)
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN total_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_monthly_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (
        status = 'settled'
        OR (status = 'reserved' AND reservation_expires_at > v_now)
      )
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    -- Calculate usage in Weekly window
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN total_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_weekly_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (
        status = 'settled'
        OR (status = 'reserved' AND reservation_expires_at > v_now)
      )
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    -- Calculate usage in Rolling 24h window
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN total_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_rolling_24h_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (
        status = 'settled'
        OR (status = 'reserved' AND reservation_expires_at > v_now)
      )
      AND created_at >= v_24h_start;

    -- Compute available capacity per window
    v_monthly_avail := v_monthly_limit - v_monthly_used;
    v_weekly_avail := v_weekly_limit - v_weekly_used;
    v_rolling_24h_avail := v_rolling_24h_limit - v_rolling_24h_used;

    -- Check limits in order: rolling_24h, weekly, monthly
    IF v_rolling_24h_avail < p_estimated_cost_nanos THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'rolling_24h',
            'message', 'You’ve reached your AI usage limit for this period.',
            'resetsAt', NULL,
            'resetsGradually', true,
            'available_nanos', GREATEST(0, v_rolling_24h_avail)
        );
    END IF;

    IF v_weekly_avail < p_estimated_cost_nanos THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'weekly',
            'message', 'You’ve reached your AI usage limit for this period.',
            'resetsAt', to_char(v_period.weekly_window_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'resetsGradually', false,
            'available_nanos', GREATEST(0, v_weekly_avail)
        );
    END IF;

    IF v_monthly_avail < p_estimated_cost_nanos THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'monthly',
            'message', 'You’ve reached your AI usage limit for this period.',
            'resetsAt', to_char(v_period.current_period_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'resetsGradually', false,
            'available_nanos', GREATEST(0, v_monthly_avail)
        );
    END IF;

    -- Insert reservation event
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
        parent_request_id,
        payload_hash,
        metadata,
        reservation_expires_at,
        created_at
    ) VALUES (
        p_user_id,
        p_request_id,
        p_feature_key,
        p_provider,
        p_model,
        0,
        0,
        0,
        0,
        p_estimated_cost_nanos,
        p_estimated_cost_nanos,
        p_estimated_cost_nanos,
        true,
        'reserved',
        p_parent_request_id,
        p_payload_hash,
        p_metadata,
        v_expires_at,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'reserved',
        'reserved_cost_nanos', p_estimated_cost_nanos,
        'available_nanos', LEAST(v_rolling_24h_avail, v_weekly_avail, v_monthly_avail)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Override settle_ai_usage
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
BEGIN
    SELECT * INTO v_existing FROM public.ai_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

    -- Calculate exact costs in nanodollars (Input: 500 nanos/token, Output: 3000 nanos/token)
    v_input_cost := GREATEST(0, p_input_tokens) * 500;
    v_output_cost := GREATEST(0, p_output_tokens) * 3000;
    v_total_cost := v_input_cost + v_output_cost;

    IF v_existing.id IS NULL THEN
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

    UPDATE public.ai_usage_events
    SET
        input_tokens = GREATEST(0, p_input_tokens),
        output_tokens = GREATEST(0, p_output_tokens),
        total_tokens = GREATEST(0, p_input_tokens + p_output_tokens),
        input_cost_nanos = v_input_cost,
        output_cost_nanos = v_output_cost,
        total_cost_nanos = v_total_cost,
        billable = p_billable,
        status = CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
        metadata = v_existing.metadata || p_metadata,
        settled_at = v_now,
        reservation_expires_at = NULL
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'settled_cost_nanos', v_total_cost,
        'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Override release_ai_usage
CREATE OR REPLACE FUNCTION public.release_ai_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_reason TEXT DEFAULT 'cancelled'
) RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
BEGIN
    UPDATE public.ai_usage_events
    SET
        status = 'released',
        billable = false,
        total_cost_nanos = 0,
        input_cost_nanos = 0,
        output_cost_nanos = 0,
        reserved_cost_nanos = 0,
        released_at = v_now,
        reservation_expires_at = NULL,
        metadata = metadata || jsonb_build_object('release_reason', p_reason)
    WHERE user_id = p_user_id AND request_id = p_request_id AND status = 'reserved';

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'released'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Mandatory Security Revokes & Grants
REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, text, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.release_ai_usage(uuid, uuid, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_ai_usage(uuid, uuid, text) TO service_role;
