-- Migration: 20260917080000_fix_credit_balances_column_in_settle_ai_usage.sql
-- Description: Fix credit_transactions check constraint and column names in settle_ai_usage and settle_composio_usage

-- 1. Modernize and expand credit_transactions_type_check constraint to permit all legacy and modern transaction types
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'credit_transactions_type_check'
    ) THEN
        ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_type_check;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'type'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'transaction_type'
    ) THEN
        ALTER TABLE public.credit_transactions
        ADD CONSTRAINT credit_transactions_type_check
        CHECK (
            (type IS NULL OR type IN ('earned', 'consumed', 'refunded', 'expired', 'bonus', 'deduction', 'refill', 'refund', 'spend', 'usage'))
            AND
            (transaction_type IS NULL OR transaction_type IN ('earned', 'consumed', 'refunded', 'expired', 'bonus', 'deduction', 'refill', 'refund', 'spend', 'usage'))
        );
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'transaction_type'
    ) THEN
        ALTER TABLE public.credit_transactions
        ADD CONSTRAINT credit_transactions_type_check
        CHECK (transaction_type IN ('earned', 'consumed', 'refunded', 'expired', 'bonus', 'deduction', 'refill', 'refund', 'spend', 'usage'));
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'type'
    ) THEN
        ALTER TABLE public.credit_transactions
        ADD CONSTRAINT credit_transactions_type_check
        CHECK (type IN ('earned', 'consumed', 'refunded', 'expired', 'bonus', 'deduction', 'refill', 'refund', 'spend', 'usage'));
    END IF;
END $$;

-- 2. Update settle_ai_usage
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
    v_has_tx_type_col BOOLEAN := false;
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

            -- Update V2 credit_balances (correct columns: available and lifetime_spent)
            UPDATE public.credit_balances
            SET available = GREATEST(0, available - v_credits_to_charge),
                lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_charge,
                updated_at = v_now
            WHERE user_id = p_user_id;

            -- Determine column structure of credit_transactions
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'transaction_type'
            ) INTO v_has_tx_type_col;

            -- Record credit transaction in ledger dynamically with 'deduction'
            IF v_has_tx_type_col THEN
                EXECUTE 'INSERT INTO public.credit_transactions (
                    user_id, amount, balance_after, transaction_type, reference_type, reference_id, description, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'
                USING p_user_id, -v_credits_to_charge, v_new_balance, 'deduction', 'ai_usage_credit_fallback', p_request_id,
                      'AI pay-as-you-go usage (' || v_credits_to_charge || ' credit' || CASE WHEN v_credits_to_charge > 1 THEN 's' ELSE '' END || ' at $0.02/credit)',
                      v_now;
            ELSE
                EXECUTE 'INSERT INTO public.credit_transactions (
                    user_id, amount, balance_after, type, reference_type, reference_id, description, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'
                USING p_user_id, -v_credits_to_charge, v_new_balance, 'deduction', 'ai_usage_credit_fallback', p_request_id,
                      'AI pay-as-you-go usage (' || v_credits_to_charge || ' credit' || CASE WHEN v_credits_to_charge > 1 THEN 's' ELSE '' END || ' at $0.02/credit)',
                      v_now;
            END IF;
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

-- 3. Also fix settle_composio_usage
CREATE OR REPLACE FUNCTION public.settle_composio_usage(
  p_user_id UUID,
  p_action_name TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_5h_start TIMESTAMPTZ := v_now - INTERVAL '5 hours';
  v_window_start TIMESTAMPTZ;
  v_period_start TIMESTAMPTZ;
  v_plan_id TEXT := 'free';
  v_tier_limit INT := 20;
  v_used_in_window INT := 0;
  v_window_remaining INT := 0;
  v_window_reset_at TIMESTAMPTZ;
  v_allow_credit_fallback BOOLEAN := false;
  v_paid_with_credits BOOLEAN := false;
  v_credits_to_deduct INT := 1;
  v_current_credits INT := 0;
  v_new_credit_balance INT := 0;
  v_tier_config RECORD;
  v_has_tx_type_col BOOLEAN := false;
BEGIN
  -- Row lock on profiles
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Read subscription/plan
  SELECT COALESCE(sub.tier, p.subscription_tier, 'free')
  INTO v_plan_id
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions sub
    ON sub.user_id = p.id AND sub.status = 'active'
  WHERE p.id = p_user_id;

  v_plan_id := LOWER(COALESCE(v_plan_id, 'free'));

  -- Look up tier limit
  SELECT composio_limit_5h, allow_credit_fallback
  INTO v_tier_config
  FROM public.ai_usage_tier_limits
  WHERE tier = v_plan_id;

  IF FOUND THEN
    v_tier_limit := COALESCE(v_tier_config.composio_limit_5h, 20);
    v_allow_credit_fallback := COALESCE(v_tier_config.allow_credit_fallback, false);
  ELSE
    CASE v_plan_id
      WHEN 'ultra' THEN v_tier_limit := 250; v_allow_credit_fallback := true;
      WHEN 'pro'   THEN v_tier_limit := 100; v_allow_credit_fallback := true;
      ELSE              v_tier_limit := 20;  v_allow_credit_fallback := false;
    END CASE;
  END IF;

  -- Count usage in rolling 5h window
  SELECT COUNT(*), MIN(created_at)
  INTO v_used_in_window, v_window_start
  FROM public.composio_usage_events
  WHERE user_id = p_user_id
    AND created_at >= v_5h_start
    AND COALESCE((metadata->>'paid_with_credits')::BOOLEAN, false) = false;

  v_used_in_window := COALESCE(v_used_in_window, 0);

  IF v_used_in_window >= v_tier_limit THEN
    IF NOT v_allow_credit_fallback THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', '5H_LIMIT_EXCEEDED',
        'message', format('Composio automation limit of %s actions per 5 hours reached for the %s plan. Upgrade your plan or wait for the limit to reset.', v_tier_limit, v_plan_id),
        'limit', v_tier_limit,
        'used', v_used_in_window,
        'reset_at', COALESCE(v_window_start + INTERVAL '5 hours', v_now + INTERVAL '5 hours')
      );
    END IF;

    -- Credit fallback
    SELECT balance INTO v_current_credits
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF COALESCE(v_current_credits, 0) < v_credits_to_deduct THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INSUFFICIENT_CREDITS',
        'message', format('Composio 5-hour limit reached and you have insufficient credits (%s available, %s required) for pay-as-you-go automation.', COALESCE(v_current_credits, 0), v_credits_to_deduct),
        'credits_available', COALESCE(v_current_credits, 0),
        'credits_required', v_credits_to_deduct,
        'reset_at', COALESCE(v_window_start + INTERVAL '5 hours', v_now + INTERVAL '5 hours')
      );
    END IF;

    v_paid_with_credits := true;

    UPDATE public.user_credits
    SET balance = balance - v_credits_to_deduct,
        lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
        total_consumed = COALESCE(total_consumed, 0) + v_credits_to_deduct,
        updated_at = v_now
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_credit_balance;

    -- Sync credit_balances table with correct columns (available, lifetime_spent)
    UPDATE public.credit_balances
    SET available = GREATEST(0, available - v_credits_to_deduct),
        lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
        updated_at = v_now
    WHERE user_id = p_user_id;

    -- Determine column structure of credit_transactions
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'transaction_type'
    ) INTO v_has_tx_type_col;

    -- Record transaction ledger entry dynamically with 'deduction'
    IF v_has_tx_type_col THEN
        EXECUTE 'INSERT INTO public.credit_transactions (
            user_id, amount, balance_after, transaction_type, reference_type, reference_id, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'
        USING p_user_id, -v_credits_to_deduct, v_new_credit_balance, 'deduction', 'composio_credit_fallback', gen_random_uuid(),
              format('Composio automation: %s (credit fallback at 1 credit/action)', p_action_name),
              v_now;
    ELSE
        EXECUTE 'INSERT INTO public.credit_transactions (
            user_id, amount, balance_after, type, reference_type, reference_id, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'
        USING p_user_id, -v_credits_to_deduct, v_new_credit_balance, 'deduction', 'composio_credit_fallback', gen_random_uuid(),
              format('Composio automation: %s (credit fallback at 1 credit/action)', p_action_name),
              v_now;
    END IF;
  END IF;

  -- Record usage event
  INSERT INTO public.composio_usage_events (
    user_id,
    action_name,
    status,
    created_at,
    metadata
  ) VALUES (
    p_user_id,
    p_action_name,
    'completed',
    v_now,
    p_metadata || jsonb_build_object(
      'paid_with_credits', v_paid_with_credits,
      'credits_deducted', CASE WHEN v_paid_with_credits THEN v_credits_to_deduct ELSE 0 END,
      'plan_id', v_plan_id
    )
  );

  IF NOT v_paid_with_credits THEN
    v_used_in_window := v_used_in_window + 1;
  END IF;

  v_window_remaining := GREATEST(0, v_tier_limit - v_used_in_window);
  v_window_reset_at := COALESCE(v_window_start + INTERVAL '5 hours', v_now + INTERVAL '5 hours');

  RETURN jsonb_build_object(
    'success', true,
    'action_name', p_action_name,
    'paid_with_credits', v_paid_with_credits,
    'credits_deducted', CASE WHEN v_paid_with_credits THEN v_credits_to_deduct ELSE 0 END,
    'credit_balance', CASE WHEN v_paid_with_credits THEN v_new_credit_balance ELSE NULL END,
    'limit', v_tier_limit,
    'used', v_used_in_window,
    'remaining_in_window', v_window_remaining,
    'reset_at', v_window_reset_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_composio_usage(uuid, text, jsonb) TO service_role;
