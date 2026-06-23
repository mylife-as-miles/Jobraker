-- Hotfix: Align consume_credits and legacy RPCs with credit_transactions check constraints and schema variants.
-- Redefine consume_credits to use 'deduction' instead of 'consumed' to satisfy check constraints.

CREATE OR REPLACE FUNCTION public.consume_credits(
    p_user_id uuid,
    p_feature_type text,
    p_feature_name text,
    p_reference_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean AS $$
DECLARE
    v_cost integer;
    v_current_balance integer;
    v_feature_description text;
    v_user_tier text;
    v_tier_check boolean;
    v_has_type_col boolean;
    v_has_balance_before boolean;
BEGIN
    -- 1. Check user tier and access limits
    v_user_tier := public.get_user_tier(p_user_id);

    IF p_feature_type = 'job_search' AND p_feature_name = 'job_match_analysis' THEN
        v_tier_check := public.check_tier_access(p_user_id, 'Basics');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'Match score analysis requires Basics, Pro, or Ultimate subscription';
        END IF;
    END IF;

    IF p_feature_type = 'cover_letter' AND p_feature_name IN ('ai_generation', 'optimization') THEN
        v_tier_check := public.check_tier_access(p_user_id, 'Basics');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'Cover letter AI features require Basics, Pro, or Ultimate subscription';
        END IF;
    END IF;

    IF p_feature_type = 'ai_chat' THEN
        v_tier_check := public.check_tier_access(p_user_id, 'Pro');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'AI Chat assistant requires Pro or Ultimate subscription';
        END IF;
    END IF;

    -- 2. Fetch the feature cost
    SELECT cost, description
    INTO v_cost, v_feature_description
    FROM public.credit_costs
    WHERE feature_type = p_feature_type
      AND feature_name = p_feature_name
      AND is_active = true;

    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Feature not found or inactive: %.%', p_feature_type, p_feature_name;
    END IF;

    -- 3. Lock user credits and verify balance
    SELECT balance INTO v_current_balance
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < v_cost THEN
        RETURN false;
    END IF;

    -- 4. Deduct user credits
    UPDATE public.user_credits
    SET
        balance = balance - v_cost,
        lifetime_spent = COALESCE(lifetime_spent, 0) + v_cost,
        total_consumed = COALESCE(total_consumed, 0) + v_cost,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id;

    -- 5. Detect columns on credit_transactions dynamically
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'type'
    ) INTO v_has_type_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    -- 6. Insert transaction with correct type/transaction_type and balance columns
    IF v_has_type_col THEN
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_before,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                'deduction',
                v_cost,
                v_current_balance,
                v_current_balance - v_cost,
                v_feature_description,
                p_feature_type,
                p_reference_id,
                jsonb_build_object('tier', v_user_tier) || p_metadata
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                'deduction',
                v_cost,
                v_current_balance - v_cost,
                v_feature_description,
                p_feature_type,
                p_reference_id,
                jsonb_build_object('tier', v_user_tier) || p_metadata
            );
        END IF;
    ELSE
        -- Fall back to transaction_type
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                'deduction',
                v_cost,
                v_current_balance,
                v_current_balance - v_cost,
                v_feature_description,
                p_feature_type,
                p_reference_id,
                jsonb_build_object('tier', v_user_tier) || p_metadata
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id,
                transaction_type,
                amount,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                'deduction',
                v_cost,
                v_current_balance - v_cost,
                v_feature_description,
                p_feature_type,
                p_reference_id,
                jsonb_build_object('tier', v_user_tier) || p_metadata
            );
        END IF;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redefine deduct_job_search_credits to be null-safe / balance_before safe
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
    v_has_type_col BOOLEAN;
    v_has_balance_before BOOLEAN;
BEGIN
    v_credits_to_deduct := LEAST(p_jobs_count, 10);
    
    SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, 0, 0, 0)
        RETURNING balance INTO v_current_balance;
    END IF;
    
    IF v_current_balance < v_credits_to_deduct THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient credits', 'current_balance', v_current_balance);
    END IF;
    
    UPDATE public.user_credits 
    SET balance = balance - v_credits_to_deduct, 
        lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct, 
        total_consumed = COALESCE(total_consumed, 0) + v_credits_to_deduct,
        updated_at = NOW()
    WHERE user_id = p_user_id 
    RETURNING balance INTO v_new_balance;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'type'
    ) INTO v_has_type_col;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'balance_before'
    ) INTO v_has_balance_before;
    
    IF v_has_type_col THEN
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_current_balance, v_new_balance, 'Job search', 'job_search');
        ELSE
            INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Job search', 'job_search');
        END IF;
    ELSE
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_before, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_current_balance, v_new_balance, 'Job search', 'job_search');
        ELSE
            INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Job search', 'job_search');
        END IF;
    END IF;
    
    RETURN json_build_object('success', true, 'credits_deducted', v_credits_to_deduct, 'remaining_balance', v_new_balance);
END;
$$;

-- Redefine deduct_auto_apply_credits to be null-safe / balance_before safe
CREATE OR REPLACE FUNCTION public.deduct_auto_apply_credits(
    p_user_id UUID,
    p_jobs_count INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance INTEGER;
    v_credits_to_deduct INTEGER;
    v_new_balance INTEGER;
    v_has_type_col BOOLEAN;
    v_has_balance_before BOOLEAN;
    v_has_total_consumed BOOLEAN;
BEGIN
    IF p_jobs_count IS NULL OR p_jobs_count <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Invalid jobs count. Must be greater than 0.');
    END IF;

    v_credits_to_deduct := p_jobs_count * 5;

    SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, 0, 0, 0)
        RETURNING balance INTO v_current_balance;
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
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_credits' AND column_name = 'total_consumed'
    ) INTO v_has_total_consumed;

    IF v_has_total_consumed THEN
        UPDATE public.user_credits
        SET balance = balance - v_credits_to_deduct,
            lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
            total_consumed = COALESCE(total_consumed, 0) + v_credits_to_deduct,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;
    ELSE
        UPDATE public.user_credits
        SET balance = balance - v_credits_to_deduct,
            lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'type'
    ) INTO v_has_type_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    IF v_has_type_col THEN
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (user_id, type, amount, balance_before, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_current_balance, v_new_balance, 'Auto apply', 'auto_apply');
        ELSE
            INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Auto apply', 'auto_apply');
        END IF;
    ELSE
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_before, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_current_balance, v_new_balance, 'Auto apply', 'auto_apply');
        ELSE
            INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_after, description, reference_type)
            VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Auto apply', 'auto_apply');
        END IF;
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
