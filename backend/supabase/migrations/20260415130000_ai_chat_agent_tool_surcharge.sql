-- Option C: Agent mode charges extra credits only when tools run (per tool round).
-- Surcharge is always deducted from credit balance (not from free chat quota).

INSERT INTO public.credit_costs (
    feature_type,
    feature_name,
    cost,
    description,
    is_active
) VALUES (
    'ai_chat',
    'agent_tool_round',
    1,
    'Agent mode: +1 credit per round where tools run (after base message credit)',
    true
)
ON CONFLICT (feature_type, feature_name)
DO UPDATE SET
    cost = EXCLUDED.cost,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = NOW();

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
        'consumed',
        p_credits,
        v_new_balance + p_credits,
        v_new_balance,
        'AI chat agent tool round',
        'ai_chat_agent'
    );

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_chat_tool_surcharge(UUID, INT) TO service_role;
