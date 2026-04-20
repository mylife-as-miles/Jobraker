-- Auto-apply credit deduction: NULL-safe lifetime_spent, optional total_consumed,
-- and explicit EXECUTE for service_role (edge functions call RPC as service_role).

CREATE OR REPLACE FUNCTION public.deduct_auto_apply_credits(
    p_user_id UUID,
    p_jobs_count INTEGER
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance INTEGER;
    v_credits_to_deduct INTEGER;
    v_new_balance INTEGER;
    v_has_type_column BOOLEAN;
    v_has_total_consumed BOOLEAN;
BEGIN
    IF p_jobs_count IS NULL OR p_jobs_count <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid jobs count. Must be greater than 0.'
        );
    END IF;

    v_credits_to_deduct := p_jobs_count * 5;

    SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id;

    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, 0, 0, 0);
        v_current_balance := 0;
    END IF;

    IF v_current_balance < v_credits_to_deduct THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Insufficient credits',
            'current_balance', v_current_balance,
            'required_credits', v_credits_to_deduct
        );
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_credits'
          AND column_name = 'total_consumed'
    ) INTO v_has_total_consumed;

    IF v_has_total_consumed THEN
        UPDATE public.user_credits
        SET
            balance = balance - v_credits_to_deduct,
            lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
            total_consumed = COALESCE(total_consumed, 0) + v_credits_to_deduct,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;
    ELSE
        UPDATE public.user_credits
        SET
            balance = balance - v_credits_to_deduct,
            lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'type'
    ) INTO v_has_type_column;

    IF v_has_type_column THEN
        INSERT INTO public.credit_transactions (
            user_id, type, amount, balance_after, description, reference_type
        ) VALUES (
            p_user_id,
            'deduction',
            v_credits_to_deduct,
            v_new_balance,
            'Auto apply',
            'auto_apply'
        );
    ELSE
        INSERT INTO public.credit_transactions (
            user_id, transaction_type, amount, balance_after, description, reference_type
        ) VALUES (
            p_user_id,
            'deduction',
            v_credits_to_deduct,
            v_new_balance,
            'Auto apply',
            'auto_apply'
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'credits_deducted', v_credits_to_deduct,
        'remaining_balance', v_new_balance,
        'jobs_count', p_jobs_count
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Error deducting credits: ' || SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_auto_apply_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_auto_apply_credits(UUID, INTEGER) TO service_role;
