-- Migration: 20260904130000_composio_usage_5h_limit_and_credit_fallback.sql
-- Description: Align Composio usage reservation & settlement with 5-hour rolling limit and pay-as-you-go credit fallback

-- 1. Update public.reserve_composio_usage
CREATE OR REPLACE FUNCTION public.reserve_composio_usage(
  p_user_id uuid,
  p_request_id uuid,
  p_toolkit_slug text,
  p_tool_slug text,
  p_parent_request_id uuid DEFAULT NULL::uuid,
  p_payload_hash text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing RECORD;
  v_class TEXT;
  v_weight BIGINT;
  v_now TIMESTAMPTZ := now();
  v_tier TEXT;
  v_period RECORD;
  v_m BIGINT := 0;
  v_w BIGINT := 0;
  v_d BIGINT := 0;
  v_ml BIGINT;
  v_wl BIGINT;
  v_dl BIGINT;
  v_limited_by TEXT := NULL;
  v_avail BIGINT;
  v_credit_balance BIGINT := 0;
  v_credits_needed BIGINT := 0;
  v_paid_with_credits BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR coalesce(p_toolkit_slug,'')='' OR coalesce(p_tool_slug,'')='' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_RESERVATION_INPUT';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  SELECT * INTO v_existing
  FROM public.composio_usage_events
  WHERE user_id = p_user_id AND request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.toolkit_slug IS DISTINCT FROM p_toolkit_slug OR v_existing.tool_slug IS DISTINCT FROM p_tool_slug OR v_existing.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_REQUEST_ID_REUSE', 'status', v_existing.status);
    END IF;
    IF v_existing.status = 'reserved' AND v_existing.reservation_expires_at > v_now THEN
      RETURN jsonb_build_object('success', false, 'error', 'AI_REQUEST_IN_PROGRESS', 'status', 'reserved', 'request_id', p_request_id);
    END IF;
    IF v_existing.status = 'reserved' THEN
      UPDATE public.composio_usage_events
      SET status = 'released',
          billable = false,
          reserved_cost_nanos = 0,
          reservation_expires_at = NULL,
          released_at = v_now,
          metadata = metadata || jsonb_build_object('release_reason', 'reservation_expired')
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', false, 'error', 'AI_REQUEST_EXPIRED', 'status', 'released');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'AI_REQUEST_ALREADY_COMPLETED', 'status', v_existing.status, 'request_id', p_request_id);
  END IF;

  SELECT call_class INTO v_class
  FROM public.composio_tool_classifications
  WHERE toolkit_slug = p_toolkit_slug AND tool_slug = p_tool_slug;
  v_class := coalesce(v_class, 'pro');

  SELECT billable_cost_nanos INTO v_weight
  FROM public.internal_provider_pricing
  WHERE provider = 'composio' AND usage_class = v_class;
  v_weight := coalesce(v_weight, 897000);

  v_tier := public.get_user_tier(p_user_id);
  SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
  INTO v_ml, v_wl, v_dl
  FROM public.get_ai_tier_limits(v_tier);

  SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
  INTO v_m
  FROM public.user_combined_ai_usage_events
  WHERE user_id = p_user_id AND billable AND (status='settled' OR (status='reserved' AND reservation_expires_at > v_now))
    AND created_at >= v_period.current_period_start AND created_at < v_period.current_period_end;

  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
  INTO v_w
  FROM public.user_combined_ai_usage_events
  WHERE user_id = p_user_id AND billable AND (status='settled' OR (status='reserved' AND reservation_expires_at > v_now))
    AND created_at >= v_period.weekly_window_start AND created_at < v_period.weekly_window_end;

  -- Rolling 5-Hour usage window (previously 24 hours)
  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
  INTO v_d
  FROM public.user_combined_ai_usage_events
  WHERE user_id = p_user_id AND billable AND (status='settled' OR (status='reserved' AND reservation_expires_at > v_now))
    AND created_at >= v_now - INTERVAL '5 hours';

  -- Check limits in order: rolling_5h, weekly, monthly
  IF (v_dl - v_d) < v_weight THEN
    v_limited_by := 'rolling_5h';
    v_avail := GREATEST(0, v_dl - v_d);
  ELSIF (v_wl - v_w) < v_weight THEN
    v_limited_by := 'weekly';
    v_avail := GREATEST(0, v_wl - v_w);
  ELSIF (v_ml - v_m) < v_weight THEN
    v_limited_by := 'monthly';
    v_avail := GREATEST(0, v_ml - v_m);
  END IF;

  IF v_limited_by IS NOT NULL THEN
    -- Calculate required credits for pay-as-you-go fallback
    -- Conversion ratio: $0.02 = 1 credit = 20,000,000 nanodollars
    v_credits_needed := GREATEST(1, CEIL(v_weight::NUMERIC / 20000000.0)::BIGINT);

    SELECT COALESCE(balance, 0) INTO v_credit_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF v_credit_balance >= v_credits_needed THEN
      -- Allow reservation with pay-as-you-go credit fallback
      v_paid_with_credits := true;
    ELSE
      -- Both plan allowance and account credits are insufficient
      RETURN jsonb_build_object(
        'success', false,
        'error', 'AI_USAGE_LIMIT_REACHED',
        'window', v_limited_by,
        'resetsAt', CASE
          WHEN v_limited_by = 'rolling_5h' THEN (
            SELECT MIN(created_at) + INTERVAL '5 hours'
            FROM public.user_combined_ai_usage_events
            WHERE user_id = p_user_id AND billable
              AND created_at >= v_now - INTERVAL '5 hours'
          )
          WHEN v_limited_by = 'weekly' THEN v_period.weekly_window_end
          ELSE v_period.current_period_end
        END,
        'resetsGradually', (v_limited_by = 'rolling_5h'),
        'available_nanos', COALESCE(v_avail, 0),
        'credits_needed', v_credits_needed,
        'credits_available', COALESCE(v_credit_balance, 0)
      );
    END IF;
  END IF;

  INSERT INTO public.composio_usage_events(
    user_id,
    request_id,
    parent_request_id,
    toolkit_slug,
    tool_slug,
    call_class,
    reserved_cost_nanos,
    billable_cost_nanos,
    provider_cost_nanos,
    billable,
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
    v_class,
    v_weight,
    0,
    0,
    NOT v_paid_with_credits, -- billable against plan allowance only if not paid with credits
    'reserved',
    p_payload_hash,
    v_now + INTERVAL '5 minutes',
    p_metadata || jsonb_build_object(
      'paid_with_credits', v_paid_with_credits,
      'credits_needed', v_credits_needed,
      'limited_by', v_limited_by
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'status', 'reserved',
    'request_id', p_request_id,
    'call_class', v_class,
    'reserved_cost_nanos', v_weight,
    'paid_with_credits', v_paid_with_credits,
    'credits_needed', v_credits_needed
  );
END;
$function$;

-- 2. Update public.settle_composio_usage
CREATE OR REPLACE FUNCTION public.settle_composio_usage(
  p_user_id uuid,
  p_request_id uuid,
  p_tool_slug text,
  p_execution_id text DEFAULT NULL::text,
  p_composio_log_id text DEFAULT NULL::text,
  p_session_id text DEFAULT NULL::text,
  p_connected_account_id text DEFAULT NULL::text,
  p_call_class text DEFAULT NULL::text,
  p_provider_cost_nanos bigint DEFAULT 0,
  p_billable boolean DEFAULT true,
  p_failure_owner text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_event RECORD;
  v_now TIMESTAMPTZ := now();
  v_class TEXT;
  v_weight BIGINT := 0;
  v_m BIGINT := 0;
  v_w BIGINT := 0;
  v_d BIGINT := 0;
  v_tier TEXT;
  v_period RECORD;
  v_ml BIGINT;
  v_wl BIGINT;
  v_dl BIGINT;
  v_bill BIGINT := 0;
  v_paid_with_credits BOOLEAN := false;
  v_credits_to_deduct BIGINT := 0;
  v_new_credit_balance BIGINT;
BEGIN
  IF p_provider_cost_nanos < 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_PROVIDER_COST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  SELECT * INTO v_event
  FROM public.composio_usage_events
  WHERE user_id = p_user_id AND request_id = p_request_id AND tool_slug = p_tool_slug
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_RESERVATION');
  END IF;

  IF v_event.status IN ('settled', 'failed') THEN
    IF v_event.billable IS NOT DISTINCT FROM p_billable AND v_event.provider_cost_nanos = p_provider_cost_nanos THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'status', v_event.status,
        'provider_cost_nanos', v_event.provider_cost_nanos,
        'billable_cost_nanos', v_event.billable_cost_nanos
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'SETTLEMENT_IDEMPOTENCY_MISMATCH', 'status', v_event.status);
  END IF;

  IF v_event.status <> 'reserved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'RESERVATION_NOT_SETTLEABLE', 'status', v_event.status);
  END IF;

  IF v_event.reservation_expires_at IS NULL OR v_event.reservation_expires_at <= v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'EXPIRED_RESERVATION', 'status', 'reserved');
  END IF;

  v_class := v_event.call_class;
  SELECT billable_cost_nanos INTO v_weight
  FROM public.internal_provider_pricing
  WHERE provider = 'composio' AND usage_class = v_class;
  v_weight := coalesce(v_weight, v_event.reserved_cost_nanos);

  v_paid_with_credits := (v_event.metadata->>'paid_with_credits')::boolean IS TRUE;

  IF p_billable THEN
    IF v_paid_with_credits THEN
      -- Pay-as-you-go credit deduction
      -- Rate: $0.02 per credit = 20,000,000 nanos per credit
      v_credits_to_deduct := GREATEST(1, CEIL(v_weight::NUMERIC / 20000000.0)::BIGINT);

      UPDATE public.user_credits
      SET balance = GREATEST(0, balance - v_credits_to_deduct),
          lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
          total_consumed = COALESCE(total_consumed, 0) + v_credits_to_deduct,
          updated_at = v_now
      WHERE user_id = p_user_id
      RETURNING balance INTO v_new_credit_balance;

      -- Sync credit_balances table if present
      UPDATE public.credit_balances
      SET balance = GREATEST(0, balance - v_credits_to_deduct),
          total_spent = COALESCE(total_spent, 0) + v_credits_to_deduct,
          updated_at = v_now
      WHERE user_id = p_user_id;

      -- Record transaction ledger entry
      INSERT INTO public.credit_transactions (
        user_id,
        amount,
        balance_after,
        transaction_type,
        reference_type,
        reference_id,
        description,
        created_at
      ) VALUES (
        p_user_id,
        -v_credits_to_deduct,
        COALESCE(v_new_credit_balance, 0),
        'usage',
        'ai_usage_credit_fallback',
        p_request_id::text,
        'AI usage credit fallback for ' || p_tool_slug,
        v_now
      );

      v_bill := 0; -- Not billed against plan allowance
    ELSE
      -- Bill against plan allowance (using 5-hour rolling window)
      v_tier := public.get_user_tier(p_user_id);
      SELECT monthly_allowance_nanos, weekly_allowance_nanos, rolling_24h_allowance_nanos
      INTO v_ml, v_wl, v_dl
      FROM public.get_ai_tier_limits(v_tier);

      SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

      SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
      INTO v_m
      FROM public.user_combined_ai_usage_events
      WHERE user_id = p_user_id AND NOT (usage_source = 'integration' AND request_id = p_request_id)
        AND billable AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
        AND created_at >= v_period.current_period_start AND created_at < v_period.current_period_end;

      SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
      INTO v_w
      FROM public.user_combined_ai_usage_events
      WHERE user_id = p_user_id AND NOT (usage_source = 'integration' AND request_id = p_request_id)
        AND billable AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
        AND created_at >= v_period.weekly_window_start AND created_at < v_period.weekly_window_end;

      SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END), 0)
      INTO v_d
      FROM public.user_combined_ai_usage_events
      WHERE user_id = p_user_id AND NOT (usage_source = 'integration' AND request_id = p_request_id)
        AND billable AND (status = 'settled' OR (status = 'reserved' AND reservation_expires_at > v_now))
        AND created_at >= v_now - INTERVAL '5 hours';

      v_bill := least(v_weight, greatest(0, least(v_ml - v_m, v_wl - v_w, v_dl - v_d)));
    END IF;
  END IF;

  UPDATE public.composio_usage_events
  SET status = CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
      billable = (p_billable AND NOT v_paid_with_credits),
      provider_cost_nanos = p_provider_cost_nanos,
      billable_cost_nanos = v_bill,
      reserved_cost_nanos = 0,
      failure_owner = p_failure_owner,
      execution_id = coalesce(p_execution_id, execution_id),
      composio_log_id = coalesce(p_composio_log_id, composio_log_id),
      session_id = coalesce(p_session_id, session_id),
      connected_account_id = coalesce(p_connected_account_id, connected_account_id),
      settled_at = v_now,
      reservation_expires_at = NULL,
      metadata = metadata || p_metadata || jsonb_build_object(
        'server_call_class', v_class,
        'paid_with_credits', v_paid_with_credits,
        'credits_deducted', v_credits_to_deduct
      )
  WHERE id = v_event.id;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,
    'provider_cost_nanos', p_provider_cost_nanos,
    'billable_cost_nanos', v_bill,
    'paid_with_credits', v_paid_with_credits,
    'credits_deducted', v_credits_to_deduct
  );
END;
$function$;
