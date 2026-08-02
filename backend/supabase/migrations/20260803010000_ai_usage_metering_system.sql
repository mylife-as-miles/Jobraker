-- Migration: Production-grade AI Usage Metering & Limit System
-- Implements public.ai_usage_events ledger, atomic reservation/settlement/release RPCs, and get_ai_usage_status RPC.

-- 1. Create public.ai_usage_events ledger table
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    feature_key TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    input_cost_nanos BIGINT NOT NULL DEFAULT 0,
    output_cost_nanos BIGINT NOT NULL DEFAULT 0,
    total_cost_nanos BIGINT NOT NULL DEFAULT 0,
    billable BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'released', 'failed')),
    parent_request_id UUID NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for request_id per user (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_events_user_request ON public.ai_usage_events(user_id, request_id);

-- Performance indexes for window queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created ON public.ai_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_status_created ON public.ai_usage_events(user_id, status, created_at DESC);

-- Enable RLS and restrict direct client access
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client direct access to ai_usage_events" ON public.ai_usage_events;
CREATE POLICY "No client direct access to ai_usage_events" ON public.ai_usage_events
    FOR ALL USING (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_events TO service_role;
REVOKE ALL ON public.ai_usage_events FROM authenticated, anon;


-- 2. Helper function to get internal nanodollar allowances for a subscription tier
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
            -- Free fallback
            monthly_allowance_nanos := 500000000;     -- $0.50
            weekly_allowance_nanos := 200000000;      -- $0.20
            rolling_24h_allowance_nanos := 50000000;   -- $0.05
    END CASE;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;


-- 3. Helper function to resolve active user billing period & window timestamps
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
        v_w_end := v_start + INTERVAL '7 days';
    ELSE
        v_weeks_passed := FLOOR(EXTRACT(EPOCH FROM (v_now - v_start)) / (7 * 86400));
        v_w_start := v_start + (v_weeks_passed * INTERVAL '7 days');
        v_w_end := v_w_start + INTERVAL '7 days';
    END IF;

    current_period_start := v_start;
    current_period_end := v_end;
    weekly_window_start := v_w_start;
    weekly_window_end := v_w_end;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 4. Atomic reservation RPC: reserve_ai_usage
CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_feature_key TEXT,
    p_provider TEXT,
    p_model TEXT,
    p_estimated_cost_nanos BIGINT,
    p_parent_request_id UUID DEFAULT NULL,
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

    -- Calculate usage in Monthly window (billable settled + active reserved)
    SELECT COALESCE(SUM(total_cost_nanos), 0) INTO v_monthly_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND status IN ('settled', 'reserved')
      AND billable = true
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    -- Calculate usage in Weekly window
    SELECT COALESCE(SUM(total_cost_nanos), 0) INTO v_weekly_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND status IN ('settled', 'reserved')
      AND billable = true
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    -- Calculate usage in Rolling 24h window
    SELECT COALESCE(SUM(total_cost_nanos), 0) INTO v_rolling_24h_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND status IN ('settled', 'reserved')
      AND billable = true
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
            'resetsGradually', true
        );
    END IF;

    IF v_weekly_avail < p_estimated_cost_nanos THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'weekly',
            'message', 'You’ve reached your AI usage limit for this period.',
            'resetsAt', to_char(v_period.weekly_window_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'resetsGradually', false
        );
    END IF;

    IF v_monthly_avail < p_estimated_cost_nanos THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'monthly',
            'message', 'You’ve reached your AI usage limit for this period.',
            'resetsAt', to_char(v_period.current_period_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'resetsGradually', false
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
        billable,
        status,
        parent_request_id,
        metadata,
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
        true,
        'reserved',
        p_parent_request_id,
        p_metadata,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'reserved',
        'reserved_cost_nanos', p_estimated_cost_nanos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Settle reservation RPC: settle_ai_usage
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
BEGIN
    SELECT * INTO v_existing FROM public.ai_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

    IF v_existing.id IS NULL THEN
        -- Insert as settled directly if reservation wasn't created prior
        v_input_cost := p_input_tokens * 500;
        v_output_cost := p_output_tokens * 3000;
        v_total_cost := v_input_cost + v_output_cost;

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
            billable,
            status,
            metadata,
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
            p_billable,
            CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
            p_metadata,
            NOW()
        );

        RETURN jsonb_build_object(
            'success', true,
            'settled_cost_nanos', v_total_cost,
            'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END
        );
    END IF;

    -- Calculate exact costs in nanodollars
    v_input_cost := GREATEST(0, p_input_tokens) * 500;
    v_output_cost := GREATEST(0, p_output_tokens) * 3000;
    v_total_cost := v_input_cost + v_output_cost;

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
        metadata = v_existing.metadata || p_metadata
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'settled_cost_nanos', v_total_cost,
        'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Release reservation RPC: release_ai_usage
CREATE OR REPLACE FUNCTION public.release_ai_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_reason TEXT DEFAULT 'cancelled'
) RETURNS JSONB AS $$
BEGIN
    UPDATE public.ai_usage_events
    SET
        status = 'released',
        billable = false,
        total_cost_nanos = 0,
        input_cost_nanos = 0,
        output_cost_nanos = 0,
        metadata = metadata || jsonb_build_object('release_reason', p_reason)
    WHERE user_id = p_user_id AND request_id = p_request_id AND status = 'reserved';

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'released'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Protected User Usage Status RPC: get_ai_usage_status
CREATE OR REPLACE FUNCTION public.get_ai_usage_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
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
    v_tier := public.get_user_tier(p_user_id);

    SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
    INTO v_monthly_limit, v_weekly_limit, v_rolling_24h_limit
    FROM public.get_ai_tier_limits(v_tier);

    SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

    -- Calculate usage in Monthly window
    SELECT COALESCE(SUM(total_cost_nanos), 0) INTO v_monthly_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND status IN ('settled', 'reserved')
      AND billable = true
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    -- Calculate usage in Weekly window
    SELECT COALESCE(SUM(total_cost_nanos), 0) INTO v_weekly_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND status IN ('settled', 'reserved')
      AND billable = true
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    -- Calculate usage in Rolling 24h window
    SELECT COALESCE(SUM(total_cost_nanos), 0) INTO v_rolling_24h_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND status IN ('settled', 'reserved')
      AND billable = true
      AND created_at >= v_24h_start;

    -- Compute integer percentages (clamped 0 to 100)
    v_r24h_pct_used := LEAST(100, GREATEST(0, ROUND((v_rolling_24h_used::NUMERIC / GREATEST(1, v_rolling_24h_limit)::NUMERIC) * 100))::INT);
    v_r24h_pct_left := 100 - v_r24h_pct_used;

    v_weekly_pct_used := LEAST(100, GREATEST(0, ROUND((v_weekly_used::NUMERIC / GREATEST(1, v_weekly_limit)::NUMERIC) * 100))::INT);
    v_weekly_pct_left := 100 - v_weekly_pct_used;

    v_monthly_pct_used := LEAST(100, GREATEST(0, ROUND((v_monthly_used::NUMERIC / GREATEST(1, v_monthly_limit)::NUMERIC) * 100))::INT);
    v_monthly_pct_left := 100 - v_monthly_pct_used;

    -- Identify bottleneck limit if any
    IF v_r24h_pct_left = 0 THEN
        v_limited_by := 'rolling_24h';
        -- Find earliest event in preceding 24h to calculate when capacity frees up
        SELECT (created_at + INTERVAL '24 hours') INTO v_earliest_avail
        FROM public.ai_usage_events
        WHERE user_id = p_user_id
          AND status IN ('settled', 'reserved')
          AND billable = true
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_ai_tier_limits(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_billing_period(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_usage(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_usage_status(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_ai_usage_status(uuid) IS 'Retrieve privacy-safe AI usage status percentages and window reset timestamps for a user.';
