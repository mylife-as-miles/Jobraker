-- ============================================================================
-- CONSOLIDATED CONSOLE ERROR FIXES (v2 - Expanded Tier Support)
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- 1. FIX CREDIT DEDUCTION FUNCTIONS (use 'deduction' instead of 'consumed')
-- This resolves 'credit_transactions_type_check' constraint violations

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
    v_has_type_column BOOLEAN;
BEGIN
    v_credits_to_deduct := LEAST(p_jobs_count, 10);
    
    SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, 0, 0, 0);
        v_current_balance := 0;
    END IF;
    
    IF v_current_balance < v_credits_to_deduct THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient credits', 'current_balance', v_current_balance);
    END IF;
    
    UPDATE public.user_credits SET balance = balance - v_credits_to_deduct, lifetime_spent = lifetime_spent + v_credits_to_deduct, updated_at = NOW()
    WHERE user_id = p_user_id RETURNING balance INTO v_new_balance;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'type') INTO v_has_type_column;
    
    IF v_has_type_column THEN
        INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, reference_type)
        VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Job search', 'job_search');
    ELSE
        INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_after, description, reference_type)
        VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Job search', 'job_search');
    END IF;
    
    RETURN json_build_object('success', true, 'credits_deducted', v_credits_to_deduct, 'remaining_balance', v_new_balance);
END;
$$;

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
    v_has_type_column BOOLEAN;
BEGIN
    v_credits_to_deduct := p_jobs_count * 5;
    
    SELECT balance INTO v_current_balance FROM public.user_credits WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (p_user_id, 0, 0, 0);
        v_current_balance := 0;
    END IF;
    
    IF v_current_balance < v_credits_to_deduct THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient credits', 'current_balance', v_current_balance);
    END IF;
    
    UPDATE public.user_credits SET balance = balance - v_credits_to_deduct, lifetime_spent = lifetime_spent + v_credits_to_deduct, updated_at = NOW()
    WHERE user_id = p_user_id RETURNING balance INTO v_new_balance;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'type') INTO v_has_type_column;
    
    IF v_has_type_column THEN
        INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, reference_type)
        VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Auto apply', 'auto_apply');
    ELSE
        INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_after, description, reference_type)
        VALUES (p_user_id, 'deduction', v_credits_to_deduct, v_new_balance, 'Auto apply', 'auto_apply');
    END IF;
    
    RETURN json_build_object('success', true, 'credits_deducted', v_credits_to_deduct, 'remaining_balance', v_new_balance);
END;
$$;

-- 2. FIX SUBSCRIPTION TIER SUPPORT (Normalizing aliases)
-- This prevents Edge Function 500s and handles Starter/Professional/Executive plans

-- Normalization function
CREATE OR REPLACE FUNCTION public.normalize_tier(p_tier TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE p_tier
        WHEN 'Starter' THEN 'Basics'
        WHEN 'Basics' THEN 'Basics'
        WHEN 'Basic' THEN 'Basics'
        WHEN 'Professional' THEN 'Pro'
        WHEN 'Pro' THEN 'Pro'
        WHEN 'Executive' THEN 'Ultimate'
        WHEN 'Ultimate' THEN 'Ultimate'
        WHEN 'Enterprise' THEN 'Ultimate'
        WHEN 'Team' THEN 'Pro'
        ELSE 'Free'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update profile constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_tier_check 
    CHECK (subscription_tier IN ('Free', 'Basics', 'Starter', 'Pro', 'Professional', 'Ultimate', 'Executive', 'Enterprise', 'Team'));

-- Update helper functions to handle aliases via normalization
CREATE OR REPLACE FUNCTION public.check_tier_access(p_user_id UUID, p_required_tier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_tier TEXT;
    v_normalized_user_tier TEXT;
    v_normalized_req_tier TEXT;
    v_tier_rank JSONB := '{"Free": 0, "Basics": 1, "Pro": 2, "Ultimate": 3}'::jsonb;
BEGIN
    v_user_tier := public.get_user_tier(p_user_id);
    v_normalized_user_tier := public.normalize_tier(v_user_tier);
    v_normalized_req_tier := public.normalize_tier(p_required_tier);
    
    RETURN (v_tier_rank->>v_normalized_user_tier)::int >= (v_tier_rank->>v_normalized_req_tier)::int;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FIX RLS FOR security_audit_log (Resolve 403)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_audit_log') THEN
        ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.security_audit_log;
        CREATE POLICY "Users can insert their own audit logs"
            ON public.security_audit_log FOR INSERT
            WITH CHECK (auth.uid() = user_id);
            
        DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.security_audit_log;
        CREATE POLICY "Users can view their own audit logs"
            ON public.security_audit_log FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. ENSURE user_streaks RLS (Resolve 400/403)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_streaks') THEN
        ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Users read own streak" ON public.user_streaks;
        CREATE POLICY "Users read own streak" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can insert own streak" ON public.user_streaks;
        CREATE POLICY "Users can insert own streak" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        DROP POLICY IF EXISTS "Users can update own streak" ON public.user_streaks;
        CREATE POLICY "Users can update own streak" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;
