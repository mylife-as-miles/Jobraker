-- Update Credit System with New Specifications
-- Free: 10 credits/month
-- Pro: 1000 credits/month  
-- Ultimate: 5000 credits/month
-- New user signup bonus: 50 credits

-- Update subscription plans with new credit allocations
UPDATE "public"."subscription_plans"
SET 
    "credits_per_cycle" = 10,
    "description" = 'Free tier with 10 monthly credits for basic job search',
    "features" = '["10 monthly credits", "Basic job search (1 credit/search)", "Job applications (5 credits/application)", "Resume storage", "Application tracking", "Email notifications"]'::jsonb,
    "updated_at" = timezone('utc'::text, now())
WHERE "name" = 'Free';

UPDATE "public"."subscription_plans"
SET 
    "credits_per_cycle" = 1000,
    "price" = 49.00,
    "description" = 'Pro tier with 1000 monthly credits and advanced features',
    "features" = '["1000 monthly credits", "Everything in Free", "AI match score analysis (free)", "AI cover letter generation (free)", "AI chat assistant access", "Priority support", "Advanced analytics", "Bulk operations"]'::jsonb,
    "updated_at" = timezone('utc'::text, now())
WHERE "name" = 'Pro';

UPDATE "public"."subscription_plans"
SET 
    "credits_per_cycle" = 5000,
    "price" = 199.00,
    "description" = 'Ultimate tier with 5000 monthly credits and enterprise features',
    "features" = '["5000 monthly credits", "Everything in Pro", "Unlimited AI features", "AI chat assistant access", "24/7 phone support", "Custom integrations", "Dedicated account manager", "White-label options", "Enterprise security"]'::jsonb,
    "updated_at" = timezone('utc'::text, now())
WHERE "name" = 'Ultimate';

-- Update credit costs for features
UPDATE "public"."credit_costs"
SET 
    "cost" = 1,
    "description" = 'Search for jobs (1 credit per search)',
    "updated_at" = timezone('utc'::text, now())
WHERE "feature_type" = 'job_search' AND "feature_name" = 'search';

-- Insert or update job search cost if it doesn't exist
INSERT INTO "public"."credit_costs" (
    "feature_type", "feature_name", "cost", "description", "is_active"
) VALUES (
    'job_search', 'search', 1, 'Search for jobs (1 credit per search)', true
)
ON CONFLICT ("feature_type", "feature_name") 
DO UPDATE SET 
    "cost" = 1,
    "description" = 'Search for jobs (1 credit per search)',
    "updated_at" = timezone('utc'::text, now());

UPDATE "public"."credit_costs"
SET 
    "cost" = 5,
    "description" = 'Apply to a job automatically using AI (5 credits)',
    "updated_at" = timezone('utc'::text, now())
WHERE "feature_type" = 'job_search' AND "feature_name" = 'auto_apply';

UPDATE "public"."credit_costs"
SET 
    "cost" = 0,
    "description" = 'AI-powered job match score analysis (free for Pro/Ultimate) - Pro/Ultimate only',
    "updated_at" = timezone('utc'::text, now())
WHERE "feature_type" = 'job_search' AND "feature_name" = 'job_match_analysis';

UPDATE "public"."credit_costs"
SET 
    "cost" = 0,
    "description" = 'Generate personalized cover letter using AI (free for Pro/Ultimate) - Pro/Ultimate only',
    "updated_at" = timezone('utc'::text, now())
WHERE "feature_type" = 'cover_letter' AND "feature_name" = 'ai_generation';

UPDATE "public"."credit_costs"
SET 
    "cost" = 0,
    "description" = 'Optimize existing cover letter for specific job (free for Pro/Ultimate) - Pro/Ultimate only',
    "updated_at" = timezone('utc'::text, now())
WHERE "feature_type" = 'cover_letter' AND "feature_name" = 'optimization';

-- Insert chat feature cost (Pro/Ultimate only)
INSERT INTO "public"."credit_costs" (
    "feature_type", "feature_name", "cost", "description", "is_active"
) VALUES (
    'ai_chat', 'chat_message', 0, 'AI chat assistant - Pro/Ultimate tier only (no credits)', true
)
ON CONFLICT ("feature_type", "feature_name") 
DO UPDATE SET 
    "cost" = 0,
    "description" = 'AI chat assistant - Pro/Ultimate tier only (no credits)',
    "updated_at" = timezone('utc'::text, now());

-- Update initialize_user_credits function to give 50 credits signup bonus
CREATE OR REPLACE FUNCTION "public"."initialize_user_credits"()
RETURNS TRIGGER AS $$
BEGIN
    -- Create credit record for new user with 50 credit signup bonus
    INSERT INTO "public"."user_credits" (
        "user_id", 
        "balance", 
        "total_earned", 
        "last_reset_at"
    ) VALUES (
        NEW.id,
        50, -- Signup bonus: 50 credits
        50,
        timezone('utc'::text, now())
    );
    
    -- Record the initial credit allocation transaction
    INSERT INTO "public"."credit_transactions" (
        "user_id",
        "type",
        "amount",
        "balance_before",
        "balance_after",
        "description",
        "reference_type"
    ) VALUES (
        NEW.id,
        'earned',
        50,
        0,
        50,
        'Welcome bonus: 50 credits for new user signup',
        'signup_bonus'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add subscription_tier column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE "public"."profiles" 
        ADD COLUMN "subscription_tier" text DEFAULT 'Free' CHECK (subscription_tier IN ('Free', 'Pro', 'Ultimate'));
        
        COMMENT ON COLUMN "public"."profiles"."subscription_tier" IS 'User subscription tier: Free, Pro, or Ultimate';
    END IF;
END $$;

-- Create function to check tier access for features
CREATE OR REPLACE FUNCTION "public"."check_tier_access"(
    p_user_id uuid,
    p_required_tier text
) RETURNS boolean AS $$
DECLARE
    v_user_tier text;
    v_tier_rank integer;
    v_required_rank integer;
BEGIN
    -- Get user's current tier from profiles or user_subscriptions
    SELECT COALESCE(
        (SELECT sp.name 
         FROM user_subscriptions us
         JOIN subscription_plans sp ON us.plan_id = sp.id
         WHERE us.user_id = p_user_id 
           AND us.status = 'active'
         ORDER BY us.created_at DESC
         LIMIT 1),
        (SELECT subscription_tier FROM profiles WHERE id = p_user_id),
        'Free'
    ) INTO v_user_tier;
    
    -- Rank tiers: Free=1, Pro=2, Ultimate=3
    v_tier_rank := CASE v_user_tier
        WHEN 'Free' THEN 1
        WHEN 'Pro' THEN 2
        WHEN 'Ultimate' THEN 3
        ELSE 1
    END;
    
    v_required_rank := CASE p_required_tier
        WHEN 'Free' THEN 1
        WHEN 'Pro' THEN 2
        WHEN 'Ultimate' THEN 3
        ELSE 1
    END;
    
    RETURN v_tier_rank >= v_required_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's subscription tier
CREATE OR REPLACE FUNCTION "public"."get_user_tier"(
    p_user_id uuid
) RETURNS text AS $$
DECLARE
    v_tier text;
BEGIN
    SELECT COALESCE(
        (SELECT sp.name 
         FROM user_subscriptions us
         JOIN subscription_plans sp ON us.plan_id = sp.id
         WHERE us.user_id = p_user_id 
           AND us.status = 'active'
         ORDER BY us.created_at DESC
         LIMIT 1),
        (SELECT subscription_tier FROM profiles WHERE id = p_user_id),
        'Free'
    ) INTO v_tier;
    
    RETURN v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update consume_credits function to check tier access for restricted features
CREATE OR REPLACE FUNCTION "public"."consume_credits"(
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
BEGIN
    -- Get user's tier
    v_user_tier := get_user_tier(p_user_id);
    
    -- Check tier access for restricted features
    IF p_feature_type = 'job_search' AND p_feature_name = 'job_match_analysis' THEN
        v_tier_check := check_tier_access(p_user_id, 'Pro');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'Match score analysis requires Pro or Ultimate subscription';
        END IF;
    END IF;
    
    IF p_feature_type = 'cover_letter' AND p_feature_name IN ('ai_generation', 'optimization') THEN
        v_tier_check := check_tier_access(p_user_id, 'Pro');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'Cover letter features require Pro or Ultimate subscription';
        END IF;
    END IF;
    
    IF p_feature_type = 'ai_chat' THEN
        v_tier_check := check_tier_access(p_user_id, 'Pro');
        IF NOT v_tier_check THEN
            RAISE EXCEPTION 'AI Chat assistant requires Pro or Ultimate subscription';
        END IF;
    END IF;
    
    -- Get cost for the feature
    SELECT cost, description 
    INTO v_cost, v_feature_description
    FROM credit_costs 
    WHERE feature_type = p_feature_type 
      AND feature_name = p_feature_name 
      AND is_active = true;
    
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Feature not found or inactive: %.%', p_feature_type, p_feature_name;
    END IF;
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM user_credits 
    WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL OR v_current_balance < v_cost THEN
        -- Insufficient credits
        RETURN false;
    END IF;
    
    -- Deduct credits
    UPDATE user_credits 
    SET 
        balance = balance - v_cost,
        total_consumed = total_consumed + v_cost,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id;
    
    -- Record transaction
    INSERT INTO credit_transactions (
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
        'consumed',
        v_cost,
        v_current_balance,
        v_current_balance - v_cost,
        v_feature_description,
        p_feature_type,
        p_reference_id,
        jsonb_build_object('tier', v_user_tier) || p_metadata
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION "public"."check_tier_access"(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_user_tier"(uuid) TO authenticated;

COMMENT ON FUNCTION "public"."check_tier_access"(uuid, text) IS 'Check if user has required subscription tier or higher';
COMMENT ON FUNCTION "public"."get_user_tier"(uuid) IS 'Get user current subscription tier';
