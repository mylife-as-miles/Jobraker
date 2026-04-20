-- Agent tool surcharge: align credit_transactions insert with production schema variants
-- (type vs transaction_type, balance_before optional) and use 'deduction' for spends
-- to match deduct_* functions / CHECK constraints on many deployments.

CREATE OR REPLACE FUNCTION public.consume_ai_chat_tool_surcharge(
    p_user_id UUID,
    p_credits INT DEFAULT 1
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INT;
    v_new_balance INT;
    v_has_type_col BOOLEAN;
    v_has_balance_before BOOLEAN;
BEGIN
    IF p_credits IS NULL OR p_credits < 1 THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'invalid_amount',
            'message', 'Invalid surcharge amount.'
        );
    END IF;

    SELECT balance INTO v_balance
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_balance IS NULL OR v_balance < p_credits THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'insufficient_credits',
            'message', 'Not enough credits for this agent step. Add credits or use Ask mode for simple replies.',
            'balance', COALESCE(v_balance, 0),
            'required', p_credits
        );
    END IF;

    UPDATE public.user_credits
    SET
        balance = balance - p_credits,
        total_consumed = COALESCE(total_consumed, 0) + p_credits,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'type'
    ) INTO v_has_type_col;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    IF v_has_type_col THEN
        IF v_has_balance_before THEN
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
                p_credits,
                v_balance,
                v_new_balance,
                'AI chat agent tool round',
                'ai_chat_agent'
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_after,
                description,
                reference_type
            ) VALUES (
                p_user_id,
                'deduction',
                p_credits,
                v_new_balance,
                'AI chat agent tool round',
                'ai_chat_agent'
            );
        END IF;
    ELSE
        INSERT INTO public.credit_transactions (
            user_id,
            transaction_type,
            amount,
            balance_after,
            description,
            reference_type
        ) VALUES (
            p_user_id,
            'deduction',
            p_credits,
            v_new_balance,
            'AI chat agent tool round',
            'ai_chat_agent'
        );
    END IF;

    INSERT INTO public.feature_usage_events (
        user_id,
        feature_key,
        quantity,
        reference_type,
        metadata
    ) VALUES (
        p_user_id,
        'ai_chat_agent_tools',
        p_credits,
        'surcharge',
        jsonb_build_object('credits', p_credits)
    );

    RETURN json_build_object(
        'success', true,
        'credits_charged', p_credits,
        'balance', v_new_balance
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'database_error',
            'message', 'Could not record agent tool billing: ' || SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_chat_tool_surcharge(UUID, INT) TO service_role;
