-- Migration: 20260906140000_fix_settle_ai_usage_credit_transactions_schema.sql
-- Description: Fix column name in settle_ai_usage to transaction_type and align credit_transactions schema

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
            SET balance = GREATEST(0, balance - v_credits_to_charge),
                total_spent = COALESCE(total_spent, 0) + v_credits_to_charge,
                updated_at = v_now
            WHERE user_id = p_user_id;

            -- Record credit transaction in ledger
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
                -v_credits_to_charge,
                v_new_balance,
                'usage',
                'ai_usage_credit_fallback',
                p_request_id,
                'AI pay-as-you-go usage (' || v_credits_to_charge || ' credit' || CASE WHEN v_credits_to_charge > 1 THEN 's' ELSE '' END || ' at $0.02/credit)',
                v_now
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
