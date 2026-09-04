-- Migration: 20260904120000_ai_usage_5h_limit_credit_fallback_and_admin_reset.sql
-- 1. Fix admin_reset_user_ai_usage permissions (grant to authenticated with internal admin checks) and support 5h window
-- 2. Update get_ai_usage_status to calculate 5-hour rolling usage window
-- 3. Update reserve_ai_usage and settle_ai_usage to allow credit fallback at $0.02/credit (20,000,000 nanos)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_reset_user_ai_usage
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reset_user_ai_usage(
  p_user_id UUID,
  p_window TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_period RECORD;
  v_cutoff TIMESTAMPTZ;
  v_ai_count INT := 0;
  v_comp_count INT := 0;
BEGIN
  -- Verify caller is admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    COALESCE((auth.jwt()->'app_metadata'->>'claims_admin')::boolean, false) = true
    OR
    COALESCE((auth.jwt()->'user_metadata'->>'is_admin')::boolean, false) = true
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

  IF p_window IN ('daily', '5h', 'rolling_5h', 'rolling_24h') THEN
    v_cutoff := v_now - INTERVAL '5 hours';
  ELSIF p_window = 'weekly' THEN
    v_cutoff := v_period.weekly_window_start;
  ELSIF p_window = 'monthly' THEN
    v_cutoff := v_period.current_period_start;
  ELSE
    v_cutoff := '1970-01-01 00:00:00+00'::TIMESTAMPTZ;
  END IF;

  -- Release/zero out billable ai_usage_events
  UPDATE public.ai_usage_events
  SET billable = false,
      reserved_cost_nanos = 0,
      status = CASE WHEN status = 'reserved' THEN 'released' ELSE status END,
      metadata = metadata || jsonb_build_object('reset_by_admin', auth.uid(), 'reset_window', p_window, 'reset_at', v_now)
  WHERE user_id = p_user_id
    AND created_at >= v_cutoff
    AND billable = true;

  GET DIAGNOSTICS v_ai_count = ROW_COUNT;

  -- Release/zero out billable composio_usage_events
  UPDATE public.composio_usage_events
  SET billable = false,
      reserved_cost_nanos = 0,
      status = CASE WHEN status = 'reserved' THEN 'released' ELSE status END,
      metadata = metadata || jsonb_build_object('reset_by_admin', auth.uid(), 'reset_window', p_window, 'reset_at', v_now)
  WHERE user_id = p_user_id
    AND created_at >= v_cutoff
    AND billable = true;

  GET DIAGNOSTICS v_comp_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'window', p_window,
    'ai_events_reset', v_ai_count,
    'composio_events_reset', v_comp_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_ai_usage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_ai_usage(uuid, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_ai_usage_status (5-hour rolling capacity window)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ai_usage_status(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB AS $$
DECLARE
    v_effective_user_id UUID;
    v_tier TEXT;
    v_monthly_limit BIGINT;
    v_weekly_limit BIGINT;
    v_rolling_5h_limit BIGINT;
    v_period RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_5h_start TIMESTAMPTZ := v_now - INTERVAL '5 hours';

    v_monthly_used BIGINT := 0;
    v_weekly_used BIGINT := 0;
    v_rolling_5h_used BIGINT := 0;

    v_r5h_pct_used INT;
    v_r5h_pct_left INT;
    
    v_weekly_pct_used INT;
    v_weekly_pct_left INT;

    v_monthly_pct_used INT;
    v_monthly_pct_left INT;

    v_limited_by TEXT := NULL;
    v_earliest_avail TIMESTAMPTZ := NULL;
    v_user_credits INT := 0;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated call to get_ai_usage_status';
    END IF;

    v_tier := public.get_user_tier(v_effective_user_id);

    SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
    INTO v_monthly_limit, v_weekly_limit, v_rolling_5h_limit
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

    -- Calculate usage in Rolling 5-Hour window
    SELECT COALESCE(SUM(
        CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END
    ), 0) INTO v_rolling_5h_used
    FROM public.user_combined_ai_usage_events
    WHERE user_id = v_effective_user_id
      AND billable = true
      AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
      AND created_at >= v_5h_start;

    -- Read user's current credit balance
    SELECT COALESCE(balance, 0) INTO v_user_credits
    FROM public.user_credits
    WHERE user_id = v_effective_user_id;

    v_r5h_pct_used := LEAST(100, GREATEST(0, ROUND((v_rolling_5h_used::NUMERIC / GREATEST(1, v_rolling_5h_limit)::NUMERIC) * 100))::INT);
    v_r5h_pct_left := 100 - v_r5h_pct_used;

    v_weekly_pct_used := LEAST(100, GREATEST(0, ROUND((v_weekly_used::NUMERIC / GREATEST(1, v_weekly_limit)::NUMERIC) * 100))::INT);
    v_weekly_pct_left := 100 - v_weekly_pct_used;

    v_monthly_pct_used := LEAST(100, GREATEST(0, ROUND((v_monthly_used::NUMERIC / GREATEST(1, v_monthly_limit)::NUMERIC) * 100))::INT);
    v_monthly_pct_left := 100 - v_monthly_pct_used;

    -- Compute earliest availability timestamp if any 5h usage exists
    IF v_rolling_5h_used > 0 THEN
        SELECT (created_at + INTERVAL '5 hours') INTO v_earliest_avail
        FROM public.user_combined_ai_usage_events
        WHERE user_id = v_effective_user_id
          AND billable = true
          AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
          AND created_at >= v_5h_start
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF v_r5h_pct_left = 0 THEN
        v_limited_by := 'rolling_5h';
    ELSIF v_weekly_pct_left = 0 THEN
        v_limited_by := 'weekly';
    ELSIF v_monthly_pct_left = 0 THEN
        v_limited_by := 'monthly';
    END IF;

    RETURN jsonb_build_object(
        'plan', public.normalize_tier(v_tier),
        'rolling24h', jsonb_build_object(
            'percentUsed', v_r5h_pct_used,
            'percentLeft', v_r5h_pct_left,
            'resetsAt', v_earliest_avail,
            'resetsGradually', true,
            'nextAvailabilityAt', v_earliest_avail,
            'windowHours', 5
        ),
        'rolling5h', jsonb_build_object(
            'percentUsed', v_r5h_pct_used,
            'percentLeft', v_r5h_pct_left,
            'resetsAt', v_earliest_avail,
            'resetsGradually', true,
            'nextAvailabilityAt', v_earliest_avail,
            'windowHours', 5
        ),
        'weekly', jsonb_build_object(
            'percentUsed', v_weekly_pct_used,
            'percentLeft', v_weekly_pct_left,
            'resetsAt', v_period.weekly_window_end,
            'resetsGradually', false
        ),
        'monthly', jsonb_build_object(
            'percentUsed', v_monthly_pct_used,
            'percentLeft', v_monthly_pct_left,
            'resetsAt', v_period.current_period_end,
            'resetsGradually', false
        ),
        'limitedBy', v_limited_by,
        'creditsAvailable', v_user_credits
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_ai_usage_status(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. reserve_ai_usage (5h window & pay-as-you-go credit fallback)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
  p_user_id UUID,
  p_request_id UUID,
  p_feature_key TEXT,
  p_provider TEXT,
  p_model TEXT,
  p_estimated_cost_nanos BIGINT,
  p_parent_request_id UUID DEFAULT NULL::UUID,
  p_payload_hash TEXT DEFAULT NULL::TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing RECORD;
  v_tier TEXT;
  v_period RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_ttl INTEGER := 900;
  v_expires TIMESTAMPTZ;
  v_month BIGINT := 0;
  v_week BIGINT := 0;
  v_rolling_5h BIGINT := 0;
  v_month_limit BIGINT;
  v_week_limit BIGINT;
  v_rolling_5h_limit BIGINT;
  v_window TEXT;
  v_credit_balance INT := 0;
  v_credits_needed INT := 0;
  v_use_credits BOOLEAN := false;
  v_final_metadata JSONB;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_estimated_cost_nanos < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_RESERVATION_INPUT';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  SELECT * INTO v_existing
  FROM public.ai_usage_events
  WHERE user_id = p_user_id AND request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.feature_key IS DISTINCT FROM p_feature_key OR v_existing.provider IS DISTINCT FROM p_provider
       OR v_existing.model IS DISTINCT FROM p_model OR v_existing.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_REQUEST_ID_REUSE',
        'status', v_existing.status,
        'message', 'This request cannot be reused with different content.'
      );
    END IF;

    IF v_existing.status = 'reserved' AND v_existing.reservation_expires_at > v_now THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'AI_REQUEST_IN_PROGRESS',
        'status', 'reserved',
        'request_id', p_request_id,
        'message', 'This AI request is already in progress.'
      );
    ELSIF v_existing.status = 'reserved' THEN
      UPDATE public.ai_usage_events
      SET status = 'released',
          billable = false,
          reserved_cost_nanos = 0,
          reservation_expires_at = NULL,
          released_at = v_now,
          metadata = metadata || jsonb_build_object('release_reason', 'reservation_expired')
      WHERE id = v_existing.id;

      RETURN jsonb_build_object(
        'success', false,
        'error', 'AI_REQUEST_EXPIRED',
        'status', 'released',
        'request_id', p_request_id,
        'message', 'This AI request expired before it could start.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'AI_REQUEST_ALREADY_COMPLETED',
      'status', v_existing.status,
      'request_id', p_request_id,
      'message', 'This AI request has already completed.'
    );
  END IF;

  IF p_metadata ? 'reservation_ttl_seconds' AND (p_metadata->>'reservation_ttl_seconds') ~ '^[0-9]+$' THEN
    v_ttl := LEAST(1800, GREATEST(300, (p_metadata->>'reservation_ttl_seconds')::INTEGER));
  END IF;
  v_expires := v_now + make_interval(secs => v_ttl);

  v_tier := public.get_user_tier(p_user_id);
  SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
  INTO v_month_limit, v_week_limit, v_rolling_5h_limit
  FROM public.get_ai_tier_limits(v_tier);

  SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

  -- Monthly window
  SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
  INTO v_month
  FROM public.user_combined_ai_usage_events
  WHERE user_id = p_user_id AND billable AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
    AND created_at >= v_period.current_period_start AND created_at < v_period.current_period_end;

  -- Weekly window
  SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
  INTO v_week
  FROM public.user_combined_ai_usage_events
  WHERE user_id = p_user_id AND billable AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
    AND created_at >= v_period.weekly_window_start AND created_at < v_period.weekly_window_end;

  -- Rolling 5-hour window
  SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
  INTO v_rolling_5h
  FROM public.user_combined_ai_usage_events
  WHERE user_id = p_user_id AND billable AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
    AND created_at >= v_now - INTERVAL '5 hours';

  -- Check if user has exceeded their plan AI allowance
  IF v_rolling_5h_limit - v_rolling_5h < p_estimated_cost_nanos
     OR v_week_limit - v_week < p_estimated_cost_nanos
     OR v_month_limit - v_month < p_estimated_cost_nanos THEN

    v_window := CASE
      WHEN v_rolling_5h_limit - v_rolling_5h < p_estimated_cost_nanos THEN 'rolling_5h'
      WHEN v_week_limit - v_week < p_estimated_cost_nanos THEN 'weekly'
      ELSE 'monthly'
    END;

    -- Check if user can switch to using credits in the same dollar consumption ratio
    -- 20,000,000 nanodollars ($0.02) = 1 JobRaker Credit
    v_credits_needed := GREATEST(1, CEIL(p_estimated_cost_nanos::NUMERIC / 20000000.0)::INT);

    SELECT COALESCE(balance, 0) INTO v_credit_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF v_credit_balance >= v_credits_needed THEN
      -- User has sufficient credits: automatically switch to credits!
      v_use_credits := true;
    ELSE
      -- Neither plan allowance nor credit balance is sufficient
      RETURN jsonb_build_object(
        'success', false,
        'error', 'AI_USAGE_LIMIT_REACHED',
        'message', 'You’ve reached your AI usage limit for now. You can add credits to continue with pay-as-you-go usage.',
        'window', v_window,
        'resetsAt', NULL,
        'resetsGradually', v_window = 'rolling_5h',
        'credits_needed', v_credits_needed,
        'credits_available', v_credit_balance,
        'available_nanos', LEAST(
          GREATEST(0, v_rolling_5h_limit - v_rolling_5h),
          GREATEST(0, v_week_limit - v_week),
          GREATEST(0, v_month_limit - v_month)
        )
      );
    END IF;
  END IF;

  v_final_metadata := p_metadata;
  IF v_use_credits THEN
    v_final_metadata := v_final_metadata || jsonb_build_object(
      'paid_with_credits', true,
      'credit_rate_nanos', 20000000,
      'estimated_credits', v_credits_needed,
      'over_limit_window', v_window
    );
  END IF;

  INSERT INTO public.ai_usage_events (
    user_id, request_id, feature_key, provider, model,
    input_tokens, output_tokens, total_tokens,
    input_cost_nanos, output_cost_nanos, total_cost_nanos,
    provider_cost_nanos, estimated_provider_cost_nanos,
    billable_cost_nanos, reserved_cost_nanos,
    billable, status, parent_request_id, payload_hash,
    usage_source, provider_usage_confirmed, metadata,
    reservation_expires_at, created_at
  ) VALUES (
    p_user_id, p_request_id, p_feature_key, p_provider, p_model,
    0, 0, 0,
    0, 0, 0,
    0, 0,
    0, p_estimated_cost_nanos,
    NOT v_use_credits, -- If paying with credits, billable is false so it doesn't inflate allowance usage
    'reserved', p_parent_request_id, p_payload_hash,
    'provider', false, v_final_metadata,
    v_expires, v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'request_id', p_request_id,
    'status', 'reserved',
    'reserved_cost_nanos', p_estimated_cost_nanos,
    'paid_with_credits', v_use_credits,
    'credits_needed', v_credits_needed,
    'available_nanos', LEAST(
      v_rolling_5h_limit - v_rolling_5h,
      v_week_limit - v_week,
      v_month_limit - v_month
    ),
    'expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, text, text, bigint, uuid, text, jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. settle_ai_usage (deducts credits when paid_with_credits = true)
-- ─────────────────────────────────────────────────────────────────────────────
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
    v_computed_cost_numeric NUMERIC;
    v_provider_cost BIGINT := 0;
    v_estimated_provider_cost BIGINT := 0;
    v_billable_cost BIGINT := 0;
    v_usage_source TEXT := 'provider';
    v_provider_usage_confirmed BOOLEAN := true;
    v_paid_with_credits BOOLEAN := false;
    v_credits_to_charge INT := 0;
    v_user_credits INT := 0;
    v_new_balance INT := 0;
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

    -- Same lock order as reservation creation.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

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
    v_provider_cost := v_computed_cost_numeric::BIGINT;

    -- Check if this reservation was marked as paid with credits
    v_paid_with_credits := COALESCE((v_existing.metadata->>'paid_with_credits')::BOOLEAN, false);

    IF v_paid_with_credits THEN
        -- Convert exact nanodollars to credits: 20,000,000 nanos ($0.02) = 1 credit
        v_credits_to_charge := GREATEST(1, CEIL(v_computed_cost_numeric / 20000000.0)::INT);

        -- Deduct from user_credits
        SELECT balance INTO v_user_credits
        FROM public.user_credits
        WHERE user_id = p_user_id
        FOR UPDATE;

        IF v_user_credits IS NOT NULL THEN
            v_new_balance := GREATEST(0, v_user_credits - v_credits_to_charge);
            UPDATE public.user_credits
            SET balance = v_new_balance,
                total_consumed = COALESCE(total_consumed, 0) + v_credits_to_charge,
                lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_charge,
                updated_at = v_now
            WHERE user_id = p_user_id;

            -- Update V2 credit_balances
            UPDATE public.credit_balances
            SET available = GREATEST(0, available - v_credits_to_charge),
                lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_charge,
                updated_at = v_now
            WHERE user_id = p_user_id;

            -- Record credit transaction
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_before,
                balance_after,
                description,
                reference_type
            ) VALUES (
                p_user_id,
                'deduction',
                v_credits_to_charge,
                v_user_credits,
                v_new_balance,
                'AI pay-as-you-go usage (' || v_credits_to_charge || ' credit' || CASE WHEN v_credits_to_charge > 1 THEN 's' ELSE '' END || ' at $0.02/credit)',
                'ai_usage_credit_fallback'
            );
        END IF;

        -- Paid with credits => do not count against plan allowance
        v_billable_cost := 0;
    ELSE
        v_billable_cost := v_provider_cost;
    END IF;

    UPDATE public.ai_usage_events
    SET status = 'settled',
        input_tokens = p_input_tokens,
        output_tokens = p_output_tokens,
        total_tokens = p_input_tokens + p_output_tokens,
        input_cost_nanos = (p_input_tokens::NUMERIC * 500)::BIGINT,
        output_cost_nanos = (p_output_tokens::NUMERIC * 3000)::BIGINT,
        total_cost_nanos = v_provider_cost,
        provider_cost_nanos = v_provider_cost,
        estimated_provider_cost_nanos = v_estimated_provider_cost,
        billable_cost_nanos = v_billable_cost,
        reserved_cost_nanos = 0,
        billable = (NOT v_paid_with_credits) AND p_billable,
        usage_source = v_usage_source,
        provider_usage_confirmed = v_provider_usage_confirmed,
        metadata = metadata || p_metadata || jsonb_build_object(
          'paid_with_credits', v_paid_with_credits,
          'credits_charged', v_credits_to_charge,
          'settled_at', v_now
        ),
        settled_at = v_now,
        reservation_expires_at = NULL
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'settled',
        'billable_cost_nanos', v_billable_cost,
        'total_cost_nanos', v_provider_cost,
        'paid_with_credits', v_paid_with_credits,
        'credits_charged', v_credits_to_charge
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.settle_ai_usage(uuid, uuid, bigint, bigint, boolean, jsonb) TO service_role;
