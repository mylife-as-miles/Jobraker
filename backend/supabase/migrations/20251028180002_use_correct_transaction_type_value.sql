-- FINAL FINAL fix - use the ACTUAL allowed values from CHECK constraint
-- Column: transaction_type
-- Allowed values: 'earn', 'spend', 'refund', 'expire', 'bonus', 'refill', 'deduction'

DROP FUNCTION IF EXISTS public.deduct_job_search_credits(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.deduct_job_search_credits(
    p_user_id UUID,
    p_jobs_count INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INTEGER;
    v_credits_to_deduct INTEGER;
    v_new_balance INTEGER;
    v_result JSON;
BEGIN
    -- Calculate credits to deduct (1 credit per job, max 10 per search)
    v_credits_to_deduct := LEAST(p_jobs_count, 10);
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;
    
    -- If user doesn't have a credits record, create one
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, 0, 0, 0);
        v_current_balance := 0;
    END IF;
    
    -- Check if user has enough credits
    IF v_current_balance < v_credits_to_deduct THEN
        v_result := json_build_object(
            'success', false,
            'message', 'Insufficient credits',
            'current_balance', v_current_balance,
            'required_credits', v_credits_to_deduct
        );
        RETURN v_result;
    END IF;
    
    -- Deduct credits
    UPDATE public.user_credits
    SET 
        balance = balance - v_credits_to_deduct,
        lifetime_spent = lifetime_spent + v_credits_to_deduct,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    -- Record the transaction - use 'deduction' which is allowed by CHECK constraint
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
        v_credits_to_deduct,
        v_new_balance,
        'Job search - ' || p_jobs_count || ' jobs found',
        'job_search'
    );
    
    -- Return success result
    v_result := json_build_object(
        'success', true,
        'message', 'Credits deducted successfully',
        'credits_deducted', v_credits_to_deduct,
        'jobs_count', p_jobs_count,
        'previous_balance', v_current_balance,
        'remaining_balance', v_new_balance
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    v_result := json_build_object(
        'success', false,
        'message', 'Error deducting credits: ' || SQLERRM,
        'detail', SQLSTATE
    );
    RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.deduct_auto_apply_credits(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.deduct_auto_apply_credits(
    p_user_id UUID,
    p_jobs_count INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INTEGER;
    v_credits_to_deduct INTEGER;
    v_new_balance INTEGER;
    v_result JSON;
BEGIN
    -- Calculate credits to deduct (5 credits per auto apply)
    v_credits_to_deduct := p_jobs_count * 5;
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;
    
    -- If user doesn't have a credits record, create one
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, 0, 0, 0);
        v_current_balance := 0;
    END IF;
    
    -- Check if user has enough credits
    IF v_current_balance < v_credits_to_deduct THEN
        v_result := json_build_object(
            'success', false,
            'message', 'Insufficient credits',
            'current_balance', v_current_balance,
            'required_credits', v_credits_to_deduct
        );
        RETURN v_result;
    END IF;
    
    -- Deduct credits
    UPDATE public.user_credits
    SET 
        balance = balance - v_credits_to_deduct,
        lifetime_spent = lifetime_spent + v_credits_to_deduct,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    -- Record the transaction - use 'deduction' which is allowed by CHECK constraint
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
        v_credits_to_deduct,
        v_new_balance,
        'Auto apply - ' || p_jobs_count || ' job' || (CASE WHEN p_jobs_count > 1 THEN 's' ELSE '' END) || ' applied',
        'auto_apply'
    );
    
    -- Return success result
    v_result := json_build_object(
        'success', true,
        'message', 'Credits deducted successfully',
        'credits_deducted', v_credits_to_deduct,
        'jobs_count', p_jobs_count,
        'previous_balance', v_current_balance,
        'remaining_balance', v_new_balance
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    v_result := json_build_object(
        'success', false,
        'message', 'Error deducting credits: ' || SQLERRM,
        'detail', SQLSTATE
    );
    RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deduct_job_search_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_auto_apply_credits(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.deduct_job_search_credits IS 'Deducts credits for job searches using transaction_type=deduction (1 credit per job, max 10)';
COMMENT ON FUNCTION public.deduct_auto_apply_credits IS 'Deducts credits for auto apply using transaction_type=deduction (5 credits per job)';
