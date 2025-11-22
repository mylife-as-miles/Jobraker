-- ============================================================================
-- EXECUTE THIS SQL IN SUPABASE SQL EDITOR
-- ============================================================================
-- This combines the credit system setup and user allocation migrations
-- Run this entire script in one go in the Supabase SQL Editor
-- ============================================================================

-- PART 1: Update Credit System (from 20251027000000_update_credit_system.sql)
-- ============================================================================

-- Update Free tier
UPDATE subscription_plans
SET 
    "credits_per_month" = 10,
    "price" = 0,
    "features" = '["10 monthly credits", "Basic job search (1 credit)", "Manual applications (5 credits)", "Email notifications", "Basic analytics"]'::jsonb,
    "updated_at" = NOW()
WHERE "name" = 'Free';

-- Update Pro tier
UPDATE subscription_plans
SET 
    "credits_per_month" = 1000,
    "price" = 49.00,
    "features" = '["1000 monthly credits", "Everything in Free", "AI match score analysis (free)", "AI cover letter generation (free)", "AI chat assistant access", "Priority support", "Advanced analytics", "Bulk operations"]'::jsonb,
    "updated_at" = NOW()
WHERE "name" = 'Pro';

-- Update Ultimate tier
UPDATE subscription_plans
SET 
    "credits_per_month" = 5000,
    "price" = 199.00,
    "features" = '["5000 monthly credits", "Everything in Pro", "Unlimited AI features", "White-glove support", "Custom integrations", "API access", "Dedicated account manager", "SLA guarantee"]'::jsonb,
    "updated_at" = NOW()
WHERE "name" = 'Ultimate';

-- Update job search credit cost
UPDATE credit_costs
SET 
    "cost" = 1,
    "description" = 'Search for jobs and save to your list (1 credit per search)',
    "updated_at" = NOW()
WHERE "feature_type" = 'job' AND "feature_name" = 'search';

-- Update job application credit cost
UPDATE credit_costs
SET 
    "cost" = 5,
    "description" = 'Apply to a job with resume and cover letter (5 credits per application)',
    "updated_at" = NOW()
WHERE "feature_type" = 'job' AND "feature_name" = 'application';

-- Add/Update match score analysis cost
INSERT INTO credit_costs (feature_type, feature_name, cost, description, required_tier)
VALUES ('analysis', 'match_score', 0, 'Analyze job match score with AI (free for Pro/Ultimate) - Pro/Ultimate only', 'Pro')
ON CONFLICT (feature_type, feature_name) 
DO UPDATE SET 
    "cost" = 0,
    "description" = 'Analyze job match score with AI (free for Pro/Ultimate) - Pro/Ultimate only',
    "required_tier" = 'Pro',
    "updated_at" = NOW();

-- Add/Update cover letter generation cost
INSERT INTO credit_costs (feature_type, feature_name, cost, description, required_tier)
VALUES ('cover_letter', 'ai_generation', 0, 'Generate personalized cover letter using AI (free for Pro/Ultimate) - Pro/Ultimate only', 'Pro')
ON CONFLICT (feature_type, feature_name) 
DO UPDATE SET 
    "cost" = 0,
    "description" = 'Generate personalized cover letter using AI (free for Pro/Ultimate) - Pro/Ultimate only',
    "required_tier" = 'Pro',
    "updated_at" = NOW();

-- Add/Update cover letter optimization cost
INSERT INTO credit_costs (feature_type, feature_name, cost, description, required_tier)
VALUES ('cover_letter', 'optimization', 0, 'Optimize existing cover letter for specific job (free for Pro/Ultimate) - Pro/Ultimate only', 'Pro')
ON CONFLICT (feature_type, feature_name) 
DO UPDATE SET 
    "cost" = 0,
    "description" = 'Optimize existing cover letter for specific job (free for Pro/Ultimate) - Pro/Ultimate only',
    "required_tier" = 'Pro',
    "updated_at" = NOW();

-- Add subscription_tier column to profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN subscription_tier TEXT DEFAULT 'Free' CHECK (subscription_tier IN ('Free', 'Pro', 'Ultimate'));
        
        COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier: Free, Pro, or Ultimate';
    END IF;
END $$;

-- Create helper function to check tier access
CREATE OR REPLACE FUNCTION check_tier_access(p_user_id UUID, p_required_tier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_tier TEXT;
BEGIN
    -- Get user tier from profiles
    SELECT subscription_tier INTO v_user_tier
    FROM profiles
    WHERE id = p_user_id;
    
    -- If user not found or tier is null, default to Free
    IF v_user_tier IS NULL THEN
        v_user_tier := 'Free';
    END IF;
    
    -- Check tier hierarchy: Free < Pro < Ultimate
    IF p_required_tier = 'Free' THEN
        RETURN TRUE; -- Everyone has access to Free features
    ELSIF p_required_tier = 'Pro' THEN
        RETURN v_user_tier IN ('Pro', 'Ultimate');
    ELSIF p_required_tier = 'Ultimate' THEN
        RETURN v_user_tier = 'Ultimate';
    ELSE
        RETURN FALSE; -- Unknown tier requirement
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get user tier
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_tier TEXT;
BEGIN
    SELECT subscription_tier INTO v_tier
    FROM profiles
    WHERE id = p_user_id;
    
    RETURN COALESCE(v_tier, 'Free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update consume_credits function to include tier checking
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_feature_type TEXT,
    p_feature_name TEXT,
    p_amount INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_cost INTEGER;
    v_current_balance INTEGER;
    v_required_tier TEXT;
    v_user_tier TEXT;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Get the cost and required tier for this feature
    SELECT cost, required_tier INTO v_cost, v_required_tier
    FROM credit_costs
    WHERE feature_type = p_feature_type AND feature_name = p_feature_name;
    
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Feature cost not found for type: % name: %', p_feature_type, p_feature_name;
    END IF;
    
    -- Use provided amount or default cost
    v_cost := COALESCE(p_amount, v_cost);
    
    -- Check tier access if required
    IF v_required_tier IS NOT NULL THEN
        v_user_tier := get_user_tier(p_user_id);
        
        -- Special handling for Pro/Ultimate features
        IF p_feature_type = 'analysis' AND p_feature_name = 'match_score' THEN
            IF v_user_tier = 'Free' THEN
                RAISE EXCEPTION 'Match score analysis requires Pro or Ultimate subscription';
            END IF;
        END IF;
        
        IF p_feature_type = 'cover_letter' AND p_feature_name IN ('ai_generation', 'optimization') THEN
            IF v_user_tier = 'Free' THEN
                RAISE EXCEPTION 'Cover letter features require Pro or Ultimate subscription';
            END IF;
        END IF;
    END IF;
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'User credits record not found';
    END IF;
    
    -- Check if user has enough credits
    IF v_current_balance < v_cost THEN
        RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', v_cost, v_current_balance;
    END IF;
    
    -- Deduct credits
    v_new_balance := v_current_balance - v_cost;
    
    UPDATE user_credits
    SET 
        balance = v_new_balance,
        lifetime_spent = lifetime_spent + v_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Record transaction
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
    VALUES (
        p_user_id,
        -v_cost,
        'deduction',
        format('Used %s credits for %s: %s', v_cost, p_feature_type, p_feature_name),
        v_new_balance
    )
    RETURNING id INTO v_transaction_id;
    
    -- Return success with new balance
    RETURN json_build_object(
        'success', true,
        'balance', v_new_balance,
        'cost', v_cost,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add signup bonus constant
INSERT INTO credit_costs (feature_type, feature_name, cost, description)
VALUES ('bonus', 'signup', 50, 'New user signup bonus')
ON CONFLICT (feature_type, feature_name) DO UPDATE SET cost = 50, description = 'New user signup bonus';


-- ============================================================================
-- PART 2: Set All Users to Free Tier and Allocate Bonuses
-- (from 20251027120000_set_existing_users_free_tier_with_bonus.sql)
-- ============================================================================

-- Step 1: Update all existing profiles to Free tier if they don't have a subscription tier set
UPDATE profiles
SET subscription_tier = 'Free'
WHERE subscription_tier IS NULL OR subscription_tier = '';

-- Step 2: Ensure all users have a user_credits record
-- Insert credits for users who don't have a record yet
INSERT INTO user_credits (user_id, balance, lifetime_earned, lifetime_spent)
SELECT 
    p.id,
    50, -- New user signup bonus
    50, -- Lifetime earned starts at 50
    0   -- No spent credits yet
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM user_credits uc WHERE uc.user_id = p.id
);

-- Step 3: Add signup bonus to existing users who already have a user_credits record
-- This gives them the 50 credit bonus on top of what they have
UPDATE user_credits uc
SET 
    balance = balance + 50,
    lifetime_earned = lifetime_earned + 50,
    updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = uc.user_id
);

-- Step 4: Record the bonus transaction for all users
INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
SELECT 
    uc.user_id,
    50,
    'bonus',
    'New user signup bonus - 50 credits',
    uc.balance
FROM user_credits uc
WHERE NOT EXISTS (
    SELECT 1 
    FROM credit_transactions ct 
    WHERE ct.user_id = uc.user_id 
    AND ct.transaction_type = 'bonus' 
    AND ct.description LIKE '%signup bonus%'
);

-- Step 5: Ensure all existing user_subscriptions are properly set
-- If users have active subscriptions but profiles say Free, update profiles to match
UPDATE profiles p
SET subscription_tier = sp.name
FROM user_subscriptions us
JOIN subscription_plans sp ON us.subscription_plan_id = sp.id
WHERE p.id = us.user_id
  AND us.status = 'active'
  AND p.subscription_tier = 'Free'
  AND sp.name IN ('Pro', 'Ultimate');

-- Step 6: Add monthly credit allocation for Free tier users who were just set
-- This ensures they get their monthly 10 credits
UPDATE user_credits uc
SET 
    balance = balance + 10,
    lifetime_earned = lifetime_earned + 10,
    last_refill = NOW(),
    updated_at = NOW()
FROM profiles p
WHERE uc.user_id = p.id
  AND p.subscription_tier = 'Free'
  AND (uc.last_refill IS NULL OR uc.last_refill < NOW() - INTERVAL '1 month');

-- Step 7: Record the monthly allocation transaction for Free users
INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
SELECT 
    uc.user_id,
    10,
    'refill',
    'Free tier monthly credit allocation - 10 credits',
    uc.balance
FROM user_credits uc
JOIN profiles p ON uc.user_id = p.id
WHERE p.subscription_tier = 'Free'
  AND NOT EXISTS (
    SELECT 1 
    FROM credit_transactions ct 
    WHERE ct.user_id = uc.user_id 
    AND ct.transaction_type = 'refill' 
    AND ct.description LIKE '%Free tier monthly%'
    AND ct.created_at > NOW() - INTERVAL '1 month'
  );


-- ============================================================================
-- VERIFICATION AND SUMMARY
-- ============================================================================

-- Show summary of changes
DO $$
DECLARE
    total_users INTEGER;
    free_users INTEGER;
    pro_users INTEGER;
    ultimate_users INTEGER;
    total_credits_allocated BIGINT;
    avg_credits NUMERIC;
BEGIN
    -- Count users by tier
    SELECT COUNT(*) INTO total_users FROM profiles;
    SELECT COUNT(*) INTO free_users FROM profiles WHERE subscription_tier = 'Free';
    SELECT COUNT(*) INTO pro_users FROM profiles WHERE subscription_tier = 'Pro';
    SELECT COUNT(*) INTO ultimate_users FROM profiles WHERE subscription_tier = 'Ultimate';
    
    -- Sum and average credits
    SELECT COALESCE(SUM(balance), 0), COALESCE(AVG(balance), 0) 
    INTO total_credits_allocated, avg_credits
    FROM user_credits;
    
    -- Log the summary
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '   CREDIT SYSTEM DEPLOYMENT COMPLETE ✅';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '👥 USER DISTRIBUTION:';
    RAISE NOTICE '   • Total users: %', total_users;
    RAISE NOTICE '   • Free tier: % (%.1f%%)', free_users, (free_users::NUMERIC / NULLIF(total_users, 0) * 100);
    RAISE NOTICE '   • Pro tier: % (%.1f%%)', pro_users, (pro_users::NUMERIC / NULLIF(total_users, 0) * 100);
    RAISE NOTICE '   • Ultimate tier: % (%.1f%%)', ultimate_users, (ultimate_users::NUMERIC / NULLIF(total_users, 0) * 100);
    RAISE NOTICE '';
    RAISE NOTICE '💰 CREDIT ALLOCATION:';
    RAISE NOTICE '   • Total credits in system: %', total_credits_allocated;
    RAISE NOTICE '   • Average per user: %.2f credits', avg_credits;
    RAISE NOTICE '';
    RAISE NOTICE '📊 SUBSCRIPTION PLANS:';
    RAISE NOTICE '   • Free: 10 credits/month';
    RAISE NOTICE '   • Pro: 1,000 credits/month ($49)';
    RAISE NOTICE '   • Ultimate: 5,000 credits/month ($199)';
    RAISE NOTICE '';
    RAISE NOTICE '🎁 NEW USER BONUS: 50 credits';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '   All users have been set to Free tier with bonuses!';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- Display sample of user credits
SELECT 
    'Sample User Credits' as info,
    COUNT(*) as total_users,
    MIN(balance) as min_credits,
    MAX(balance) as max_credits,
    ROUND(AVG(balance)::NUMERIC, 2) as avg_credits,
    SUM(balance) as total_credits
FROM user_credits;
