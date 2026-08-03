-- Migration: Unify Composio Integration Usage with AI Usage Metering System
-- Creates composio_usage_events, internal_provider_pricing, user_combined_ai_usage_events view,
-- and RPCs for reserving, settling, releasing Composio usage against shared AI tier limits.

-- 1. Create composio_usage_events private table
CREATE TABLE IF NOT EXISTS public.composio_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_id UUID NOT NULL,
    parent_request_id UUID NULL,
    execution_id TEXT NULL,
    composio_log_id TEXT NULL,
    session_id TEXT NULL,
    connected_account_id TEXT NULL,
    toolkit_slug TEXT NOT NULL,
    tool_slug TEXT NOT NULL,
    call_class TEXT NOT NULL CHECK (call_class IN ('standard', 'pro')),
    provider_cost_nanos BIGINT NOT NULL DEFAULT 0,
    billable_cost_nanos BIGINT NOT NULL DEFAULT 0,
    reserved_cost_nanos BIGINT NOT NULL DEFAULT 0,
    billable BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'failed', 'released')),
    failure_owner TEXT NULL CHECK (failure_owner IN ('user', 'jobraker', 'composio', 'upstream_provider', 'authentication', 'unknown')),
    payload_hash TEXT NULL,
    reservation_expires_at TIMESTAMPTZ NULL,
    settled_at TIMESTAMPTZ NULL,
    released_at TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT composio_usage_events_user_req_tool_unique UNIQUE(user_id, request_id, tool_slug)
);

CREATE INDEX IF NOT EXISTS idx_composio_usage_events_user_created ON public.composio_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_composio_usage_events_status_expires ON public.composio_usage_events(user_id, status, reservation_expires_at);

ALTER TABLE public.composio_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.composio_usage_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.composio_usage_events TO service_role;

-- 2. Create internal_provider_pricing private table
CREATE TABLE IF NOT EXISTS public.internal_provider_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    usage_class TEXT NOT NULL,
    cost_nanos BIGINT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT internal_provider_pricing_provider_class_unique UNIQUE(provider, usage_class)
);

ALTER TABLE public.internal_provider_pricing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.internal_provider_pricing FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.internal_provider_pricing TO service_role;

-- Seed default internal costs for Composio ($0.005 standard, $0.02 pro)
INSERT INTO public.internal_provider_pricing (provider, usage_class, cost_nanos, metadata)
VALUES
    ('composio', 'standard', 5000000, '{"description": "Standard Composio tool call ($0.005)"}'::jsonb),
    ('composio', 'pro', 20000000, '{"description": "Pro/Complex Composio tool call ($0.02)"}'::jsonb)
ON CONFLICT (provider, usage_class) DO UPDATE
SET cost_nanos = EXCLUDED.cost_nanos, updated_at = NOW();

-- 3. Create user_combined_ai_usage_events view (Unifies model & Composio usage)
CREATE OR REPLACE VIEW public.user_combined_ai_usage_events AS
SELECT
    user_id,
    created_at,
    billable_cost_nanos,
    reserved_cost_nanos,
    status,
    billable,
    reservation_expires_at,
    'model' AS usage_source
FROM public.ai_usage_events

UNION ALL

SELECT
    user_id,
    created_at,
    billable_cost_nanos,
    reserved_cost_nanos,
    status,
    billable,
    reservation_expires_at,
    'integration' AS usage_source
FROM public.composio_usage_events;

REVOKE ALL ON public.user_combined_ai_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_combined_ai_usage_events TO service_role;

-- 4. RPC: reserve_composio_usage
CREATE OR REPLACE FUNCTION public.reserve_composio_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_toolkit_slug TEXT,
    p_tool_slug TEXT,
    p_parent_request_id UUID DEFAULT NULL,
    p_payload_hash TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
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

    v_cost_nanos BIGINT := 20000000; -- Default Pro cost ($0.02)
    v_call_class TEXT := 'pro';

    v_existingRECORD RECORD;
BEGIN
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'user_id and request_id are required';
    END IF;

    -- Advisory lock to prevent race conditions per user across model and integration calls
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

    -- Check for existing reservation/settlement for this idempotency key
    SELECT * INTO v_existingRECORD
    FROM public.composio_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id AND tool_slug = p_tool_slug;

    IF v_existingRECORD IS NOT NULL THEN
        IF v_existingRECORD.status = 'settled' THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'status', 'settled',
                'request_id', p_request_id,
                'cost_nanos', v_existingRECORD.billable_cost_nanos,
                'call_class', v_existingRECORD.call_class
            );
        ELSIF v_existingRECORD.status = 'reserved' AND v_existingRECORD.reservation_expires_at > v_now THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'status', 'reserved',
                'request_id', p_request_id,
                'cost_nanos', v_existingRECORD.reserved_cost_nanos,
                'call_class', v_existingRECORD.call_class
            );
        END IF;
    END IF;

    -- Resolve pricing class (check tool/toolkit classification)
    SELECT cost_nanos, usage_class INTO v_cost_nanos, v_call_class
    FROM public.internal_provider_pricing
    WHERE provider = 'composio' AND usage_class = COALESCE(p_metadata->>'call_class', 'standard')
    LIMIT 1;

    IF v_cost_nanos IS NULL THEN
        v_cost_nanos := 20000000;
        v_call_class := 'pro';
    END IF;

    -- Fetch user tier & allowances
    v_tier := public.get_user_tier(p_user_id);
    SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
    INTO v_monthly_limit, v_weekly_limit, v_rolling_24h_limit
    FROM public.get_ai_tier_limits(v_tier);

    SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

    -- Sum combined usage across model and integration events
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_monthly_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_weekly_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_rolling_24h_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_24h_start;

    -- Check limits
    IF (v_rolling_24h_used + v_cost_nanos) > v_rolling_24h_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'rolling_24h',
            'message', 'You have reached your AI usage limit for this period.'
        );
    ELSIF (v_weekly_used + v_cost_nanos) > v_weekly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'weekly',
            'message', 'You have reached your weekly AI usage limit.'
        );
    ELSIF (v_monthly_used + v_cost_nanos) > v_monthly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'monthly',
            'message', 'You have reached your monthly AI usage limit.'
        );
    END IF;

    -- Create reservation
    INSERT INTO public.composio_usage_events (
        user_id,
        request_id,
        parent_request_id,
        toolkit_slug,
        tool_slug,
        call_class,
        reserved_cost_nanos,
        billable_cost_nanos,
        status,
        payload_hash,
        reservation_expires_at,
        metadata
    ) VALUES (
        p_user_id,
        p_request_id,
        p_parent_request_id,
        p_toolkit_slug,
        p_tool_slug,
        v_call_class,
        v_cost_nanos,
        0,
        'reserved',
        p_payload_hash,
        v_now + INTERVAL '5 minutes',
        p_metadata
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'reserved_cost_nanos', v_cost_nanos,
        'call_class', v_call_class
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. RPC: settle_composio_usage
CREATE OR REPLACE FUNCTION public.settle_composio_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_tool_slug TEXT,
    p_execution_id TEXT DEFAULT NULL,
    p_composio_log_id TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_connected_account_id TEXT DEFAULT NULL,
    p_call_class TEXT DEFAULT NULL,
    p_provider_cost_nanos BIGINT DEFAULT 0,
    p_billable BOOLEAN DEFAULT true,
    p_failure_owner TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_event RECORD;
    v_call_class TEXT;
    v_target_cost BIGINT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

    SELECT * INTO v_event
    FROM public.composio_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id AND tool_slug = p_tool_slug;

    IF v_event IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'RESERVATION_NOT_FOUND',
            'message', 'No active reservation found for this Composio execution.'
        );
    END IF;

    IF v_event.status = 'settled' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'status', 'settled',
            'billable_cost_nanos', v_event.billable_cost_nanos
        );
    END IF;

    v_call_class := COALESCE(p_call_class, v_event.call_class, 'standard');

    SELECT cost_nanos INTO v_target_cost
    FROM public.internal_provider_pricing
    WHERE provider = 'composio' AND usage_class = v_call_class
    LIMIT 1;

    IF v_target_cost IS NULL THEN
        v_target_cost := v_event.reserved_cost_nanos;
    END IF;

    IF p_billable = false THEN
        v_target_cost := 0;
    END IF;

    UPDATE public.composio_usage_events
    SET
        status = CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
        call_class = v_call_class,
        billable_cost_nanos = v_target_cost,
        provider_cost_nanos = COALESCE(p_provider_cost_nanos, 0),
        billable = COALESCE(p_billable, true),
        failure_owner = p_failure_owner,
        execution_id = COALESCE(p_execution_id, execution_id),
        composio_log_id = COALESCE(p_composio_log_id, composio_log_id),
        session_id = COALESCE(p_session_id, session_id),
        connected_account_id = COALESCE(p_connected_account_id, connected_account_id),
        settled_at = v_now,
        metadata = v_event.metadata || p_metadata
    WHERE id = v_event.id;

    RETURN jsonb_build_object(
        'success', true,
        'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
        'billable_cost_nanos', v_target_cost,
        'call_class', v_call_class
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. RPC: release_composio_usage
CREATE OR REPLACE FUNCTION public.release_composio_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_tool_slug TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

    UPDATE public.composio_usage_events
    SET
        status = 'released',
        released_at = NOW(),
        metadata = metadata || jsonb_build_object('release_reason', p_reason)
    WHERE user_id = p_user_id
      AND request_id = p_request_id
      AND (p_tool_slug IS NULL OR tool_slug = p_tool_slug)
      AND status = 'reserved';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'released_count', v_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Update get_ai_usage_status to sum combined usage (Model + Composio)
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

    -- Calculate usage in Monthly window across combined events
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_monthly_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = v_effective_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    -- Calculate usage in Weekly window
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_weekly_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = v_effective_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    -- Calculate usage in Rolling 24h window
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_rolling_24h_used
    FROM public.user_combined_ai_usage_events
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
        FROM public.user_combined_ai_usage_events
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

-- 8. Update reserve_ai_usage to check user_combined_ai_usage_events
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
)
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

    v_existing_event RECORD;
    v_reservation_ttl_seconds INT := 300;
BEGIN
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'user_id and request_id are required';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

    IF p_metadata->>'reservation_ttl_seconds' IS NOT NULL THEN
        v_reservation_ttl_seconds := GREATEST(30, LEAST(3600, (p_metadata->>'reservation_ttl_seconds')::INT));
    END IF;

    SELECT * INTO v_existing_event
    FROM public.ai_usage_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

    IF v_existing_event IS NOT NULL THEN
        IF v_existing_event.status = 'settled' THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'status', 'settled',
                'request_id', p_request_id,
                'available_nanos', 0
            );
        ELSIF v_existing_event.status = 'reserved' AND v_existing_event.reservation_expires_at > v_now THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'status', 'reserved',
                'request_id', p_request_id,
                'available_nanos', v_existing_event.reserved_cost_nanos
            );
        END IF;
    END IF;

    v_tier := public.get_user_tier(p_user_id);

    SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
    INTO v_monthly_limit, v_weekly_limit, v_rolling_24h_limit
    FROM public.get_ai_tier_limits(v_tier);

    SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

    -- Calculate current combined usage from user_combined_ai_usage_events
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_monthly_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_weekly_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_rolling_24h_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_24h_start;

    IF (v_rolling_24h_used + p_estimated_cost_nanos) > v_rolling_24h_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'rolling_24h',
            'message', 'You have reached your AI usage limit for this period.'
        );
    ELSIF (v_weekly_used + p_estimated_cost_nanos) > v_weekly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'weekly',
            'message', 'You have reached your weekly AI usage limit.'
        );
    ELSIF (v_monthly_used + p_estimated_cost_nanos) > v_monthly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'monthly',
            'message', 'You have reached your monthly AI usage limit.'
        );
    END IF;

    INSERT INTO public.ai_usage_events (
        user_id,
        request_id,
        feature_key,
        provider,
        model,
        estimated_cost_nanos,
        reserved_cost_nanos,
        billable_cost_nanos,
        status,
        parent_request_id,
        payload_hash,
        reservation_expires_at,
        metadata
    ) VALUES (
        p_user_id,
        p_request_id,
        p_feature_key,
        p_provider,
        p_model,
        p_estimated_cost_nanos,
        p_estimated_cost_nanos,
        0,
        'reserved',
        p_parent_request_id,
        p_payload_hash,
        v_now + (v_reservation_ttl_seconds || ' seconds')::INTERVAL,
        p_metadata
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'available_nanos', p_estimated_cost_nanos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9. Security permissions for RPCs (Service role execution only)
REVOKE EXECUTE ON FUNCTION public.reserve_composio_usage FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_composio_usage TO service_role;

REVOKE EXECUTE ON FUNCTION public.settle_composio_usage FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_composio_usage TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_composio_usage FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_composio_usage TO service_role;
