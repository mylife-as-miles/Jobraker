-- Finalize AI usage idempotency, usage provenance, reservation TTL, and dual accounting.

ALTER TABLE public.ai_usage_events
    ADD COLUMN IF NOT EXISTS estimated_provider_cost_nanos BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS usage_source TEXT NOT NULL DEFAULT 'provider',
    ADD COLUMN IF NOT EXISTS provider_usage_confirmed BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ai_usage_events_usage_source_check'
          AND conrelid = 'public.ai_usage_events'::regclass
    ) THEN
        ALTER TABLE public.ai_usage_events
            ADD CONSTRAINT ai_usage_events_usage_source_check
            CHECK (usage_source IN ('provider', 'estimated'));
    END IF;
END;
$$;

UPDATE public.ai_usage_events
SET
    usage_source = CASE
        WHEN COALESCE((metadata->>'usage_source'), '') = 'estimated' THEN 'estimated'
        ELSE 'provider'
    END,
    provider_usage_confirmed = CASE
        WHEN COALESCE((metadata->>'usage_source'), '') = 'estimated' THEN false
        WHEN status IN ('settled', 'failed') AND provider_cost_nanos > 0 THEN true
        ELSE provider_usage_confirmed
    END,
    estimated_provider_cost_nanos = CASE
        WHEN COALESCE((metadata->>'usage_source'), '') = 'estimated'
            THEN GREATEST(0, input_cost_nanos + output_cost_nanos)
        ELSE estimated_provider_cost_nanos
    END;

-- Reservation creation is serialized per user and never treats an existing request ID as
-- permission to execute the provider again.
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
    v_ttl_seconds INTEGER := 900;
    v_expires_at TIMESTAMPTZ;

    v_monthly_used BIGINT := 0;
    v_weekly_used BIGINT := 0;
    v_rolling_24h_used BIGINT := 0;

    v_monthly_avail BIGINT;
    v_weekly_avail BIGINT;
    v_rolling_24h_avail BIGINT;
BEGIN
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_RESERVATION_INPUT: user_id and request_id are required';
    END IF;

    IF p_estimated_cost_nanos < 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_RESERVATION_INPUT: estimated cost must be non-negative';
    END IF;

    -- Serialize every reservation and settlement for this user.
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    SELECT * INTO v_existing
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND request_id = p_request_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.feature_key IS DISTINCT FROM p_feature_key
           OR v_existing.provider IS DISTINCT FROM p_provider
           OR v_existing.model IS DISTINCT FROM p_model
           OR v_existing.payload_hash IS DISTINCT FROM p_payload_hash THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_REQUEST_ID_REUSE',
                'status', v_existing.status,
                'message', 'Request ID cannot be reused for a different feature, provider, model, or payload.'
            );
        END IF;

        IF v_existing.status = 'reserved' THEN
            IF v_existing.reservation_expires_at IS NOT NULL
               AND v_existing.reservation_expires_at > v_now THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'AI_REQUEST_IN_PROGRESS',
                    'status', 'reserved',
                    'request_id', p_request_id,
                    'message', 'This AI request is already in progress.'
                );
            END IF;

            -- The existing status constraint permits released, not expired. Record expiry in metadata.
            UPDATE public.ai_usage_events
            SET
                status = 'released',
                billable = false,
                reserved_cost_nanos = 0,
                reservation_expires_at = NULL,
                released_at = v_now,
                metadata = metadata || jsonb_build_object(
                    'release_reason', 'reservation_expired',
                    'expired_at', v_now
                )
            WHERE id = v_existing.id;

            RETURN jsonb_build_object(
                'success', false,
                'error', 'AI_REQUEST_EXPIRED',
                'status', 'released',
                'request_id', p_request_id,
                'message', 'This AI request ID has expired and cannot be reused.'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_REQUEST_ALREADY_COMPLETED',
            'status', v_existing.status,
            'request_id', p_request_id,
            'message', 'This AI request ID has already completed and cannot execute the provider again.'
        );
    END IF;

    IF p_metadata ? 'reservation_ttl_seconds'
       AND (p_metadata->>'reservation_ttl_seconds') ~ '^[0-9]+$' THEN
        v_ttl_seconds := LEAST(
            1800,
            GREATEST(300, (p_metadata->>'reservation_ttl_seconds')::INTEGER)
        );
    END IF;
    v_expires_at := v_now + make_interval(secs => v_ttl_seconds);

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
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.current_period_start
      AND created_at < v_period.current_period_end;

    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_weekly_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_period.weekly_window_start
      AND created_at < v_period.weekly_window_end;

    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_rolling_24h_used
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_24h_start;

    v_monthly_avail := GREATEST(0, v_monthly_limit - v_monthly_used);
    v_weekly_avail := GREATEST(0, v_weekly_limit - v_weekly_used);
    v_rolling_24h_avail := GREATEST(0, v_rolling_24h_limit - v_rolling_24h_used);

    IF v_rolling_24h_avail < p_estimated_cost_nanos THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AI_USAGE_LIMIT_REACHED',
            'window', 'rolling_24h',
            'message', 'You’ve reached your AI usage limit for this period.',
            'resetsAt', NULL,
            'resetsGradually', true,
            'available_nanos', v_rolling_24h_avail
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
            'available_nanos', v_weekly_avail
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
            'available_nanos', v_monthly_avail
        );
    END IF;

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
        provider_cost_nanos,
        estimated_provider_cost_nanos,
        billable_cost_nanos,
        reserved_cost_nanos,
        billable,
        status,
        parent_request_id,
        payload_hash,
        usage_source,
        provider_usage_confirmed,
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
        0,
        0,
        0,
        0,
        0,
        p_estimated_cost_nanos,
        true,
        'reserved',
        p_parent_request_id,
        p_payload_hash,
        'provider',
        false,
        p_metadata,
        v_expires_at,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'request_id', p_request_id,
        'status', 'reserved',
        'reserved_cost_nanos', p_estimated_cost_nanos,
        'available_nanos', LEAST(v_rolling_24h_avail, v_weekly_avail, v_monthly_avail),
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Settlement preserves confirmed provider cost separately from estimated fallback cost.
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
    v_computed_cost BIGINT;
    v_computed_cost_numeric NUMERIC;
    v_provider_cost BIGINT := 0;
    v_estimated_provider_cost BIGINT := 0;
    v_billable_cost BIGINT := 0;
    v_usage_source TEXT := 'provider';
    v_provider_usage_confirmed BOOLEAN := true;

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

    v_computed_cost_numeric :=
        (p_input_tokens::NUMERIC * 500) + (p_output_tokens::NUMERIC * 3000);
    IF v_computed_cost_numeric > 9223372036854775807::NUMERIC THEN
        RAISE EXCEPTION USING
            ERRCODE = '22003',
            MESSAGE = 'TOKEN_INPUT_OVERFLOW: combined AI usage cost exceeds bigint accounting limits';
    END IF;

    SELECT * INTO v_existing
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MISSING_RESERVATION: cannot settle request_id % without a prior reservation', p_request_id;
    END IF;

    v_usage_source := CASE
        WHEN COALESCE(p_metadata->>'usage_source', '') = 'estimated' THEN 'estimated'
        ELSE 'provider'
    END;
    v_provider_usage_confirmed := v_usage_source = 'provider';

    v_input_cost := (p_input_tokens::NUMERIC * 500)::BIGINT;
    v_output_cost := (p_output_tokens::NUMERIC * 3000)::BIGINT;
    v_computed_cost := v_computed_cost_numeric::BIGINT;

    IF v_usage_source = 'provider' THEN
        v_provider_cost := v_computed_cost;
    ELSE
        v_estimated_provider_cost := v_computed_cost;
    END IF;

    -- Exact replays of both successful and failed settlements are idempotent.
    IF v_existing.status IN ('settled', 'failed') THEN
        IF v_existing.input_tokens = p_input_tokens
           AND v_existing.output_tokens = p_output_tokens
           AND v_existing.billable IS NOT DISTINCT FROM p_billable
           AND v_existing.usage_source IS NOT DISTINCT FROM v_usage_source THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'request_id', p_request_id,
                'provider_cost_nanos', v_existing.provider_cost_nanos,
                'estimated_provider_cost_nanos', v_existing.estimated_provider_cost_nanos,
                'billable_cost_nanos', v_existing.billable_cost_nanos,
                'usage_source', v_existing.usage_source,
                'status', v_existing.status
            );
        END IF;

        RAISE EXCEPTION
            'SETTLEMENT_IDEMPOTENCY_MISMATCH: request_id % was already settled with different usage data',
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
        v_billable_cost := LEAST(v_computed_cost, v_max_allowable_cost);
    END IF;

    UPDATE public.ai_usage_events
    SET
        input_tokens = p_input_tokens,
        output_tokens = p_output_tokens,
        total_tokens = p_input_tokens + p_output_tokens,
        input_cost_nanos = v_input_cost,
        output_cost_nanos = v_output_cost,
        provider_cost_nanos = v_provider_cost,
        estimated_provider_cost_nanos = v_estimated_provider_cost,
        billable_cost_nanos = v_billable_cost,
        total_cost_nanos = v_billable_cost,
        billable = p_billable,
        status = CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
        usage_source = v_usage_source,
        provider_usage_confirmed = v_provider_usage_confirmed,
        metadata = v_existing.metadata || p_metadata || jsonb_build_object(
            'usage_source', v_usage_source,
            'provider_usage_confirmed', v_provider_usage_confirmed,
            'provider_cost_nanos', v_provider_cost,
            'estimated_provider_cost_nanos', v_estimated_provider_cost,
            'billable_cost_nanos', v_billable_cost,
            'billing_capped', p_billable AND v_billable_cost < v_computed_cost
        ),
        settled_at = v_now,
        reservation_expires_at = NULL
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'request_id', p_request_id,
        'provider_cost_nanos', v_provider_cost,
        'estimated_provider_cost_nanos', v_estimated_provider_cost,
        'billable_cost_nanos', v_billable_cost,
        'usage_source', v_usage_source,
        'provider_usage_confirmed', v_provider_usage_confirmed,
        'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.release_ai_usage(
    p_user_id UUID,
    p_request_id UUID,
    p_reason TEXT DEFAULT 'cancelled'
) RETURNS JSONB AS $$
DECLARE
    v_existing RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_existing
    FROM public.ai_usage_events
    WHERE user_id = p_user_id
      AND request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'MISSING_RESERVATION',
            'message', 'No AI usage reservation exists for this request ID.'
        );
    END IF;

    IF v_existing.status = 'released' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'request_id', p_request_id,
            'status', 'released'
        );
    END IF;

    IF v_existing.status <> 'reserved' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'RESERVATION_NOT_RELEASABLE',
            'status', v_existing.status,
            'message', 'Only active reservations can be released.'
        );
    END IF;

    UPDATE public.ai_usage_events
    SET
        status = 'released',
        billable = false,
        total_cost_nanos = 0,
        input_cost_nanos = 0,
        output_cost_nanos = 0,
        provider_cost_nanos = 0,
        estimated_provider_cost_nanos = 0,
        billable_cost_nanos = 0,
        reserved_cost_nanos = 0,
        provider_usage_confirmed = false,
        released_at = v_now,
        reservation_expires_at = NULL,
        metadata = metadata || jsonb_build_object('release_reason', p_reason)
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'request_id', p_request_id,
        'status', 'released'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, text, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.release_ai_usage(uuid, uuid, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_ai_usage(uuid, uuid, text) TO service_role;
