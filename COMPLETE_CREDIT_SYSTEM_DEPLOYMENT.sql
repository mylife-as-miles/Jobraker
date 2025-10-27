-- ============================================================================
-- COMPLETE CREDIT SYSTEM DEPLOYMENT
-- Execute this entire script in Supabase SQL Editor
-- ============================================================================
-- This will:
-- 1. Create all credit system tables
-- 2. Insert default subscription plans and costs
-- 3. Update plans to new credit allocations
-- 4. Set all users to Free tier with bonuses
-- ============================================================================

-- PART 1: Create Credit System Tables
-- ============================================================================

-- Subscription plans with credit allocations
CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" decimal(10,2) NOT NULL DEFAULT 0,
    "currency" "text" DEFAULT 'USD' NOT NULL,
    "billing_cycle" "text" DEFAULT 'monthly' NOT NULL,
    "credits_per_month" integer NOT NULL DEFAULT 0,
    "max_users" integer,
    "features" "jsonb" DEFAULT '[]'::jsonb,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "subscription_plans_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'lifetime'::text])))
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active' NOT NULL,
    "current_period_start" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false,
    "external_subscription_id" "text",
    "trial_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'unpaid'::text, 'trialing'::text])))
);

-- User credit balances
CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "lifetime_earned" integer DEFAULT 0 NOT NULL,
    "lifetime_spent" integer DEFAULT 0 NOT NULL,
    "last_refill" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "user_credits_balance_check" CHECK (("balance" >= 0))
);

-- Credit transactions for tracking all credit movements
CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "description" "text",
    "reference_type" "text",
    "reference_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "credit_transactions_type_check" CHECK (("transaction_type" = ANY (ARRAY['earn'::text, 'spend'::text, 'refund'::text, 'expire'::text, 'bonus'::text, 'refill'::text, 'deduction'::text])))
);

-- Credit costs for different features
CREATE TABLE IF NOT EXISTS "public"."credit_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_type" "text" NOT NULL,
    "feature_name" "text" NOT NULL,
    "cost" integer NOT NULL DEFAULT 1,
    "description" "text",
    "required_tier" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL
);

-- Add primary keys only if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_pkey') THEN
        ALTER TABLE "public"."subscription_plans" ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_pkey') THEN
        ALTER TABLE "public"."user_subscriptions" ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_credits_pkey') THEN
        ALTER TABLE "public"."user_credits" ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_pkey') THEN
        ALTER TABLE "public"."credit_transactions" ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_costs_pkey') THEN
        ALTER TABLE "public"."credit_costs" ADD CONSTRAINT "credit_costs_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

-- Add unique constraints
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_credits_user_id_unique') THEN
        ALTER TABLE "public"."user_credits" ADD CONSTRAINT "user_credits_user_id_unique" UNIQUE ("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_costs_feature_unique') THEN
        ALTER TABLE "public"."credit_costs" ADD CONSTRAINT "credit_costs_feature_unique" UNIQUE ("feature_type", "feature_name");
    END IF;
END $$;

-- Enable RLS
ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_costs" ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE "public"."subscription_plans" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."user_credits" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."credit_transactions" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."credit_costs" TO "anon", "authenticated", "service_role";


-- ============================================================================
-- PART 2: Seed Default Plans and Costs
-- ============================================================================

-- Insert default subscription plans
INSERT INTO "public"."subscription_plans" (
    "name", "description", "price", "currency", "billing_cycle", "credits_per_month", 
    "features", "is_active", "sort_order"
) VALUES 
('Free', 'Perfect for getting started', 10.00, 'USD', 'monthly', 10, 
 '["10 monthly credits", "Basic job search", "Email notifications"]'::jsonb, true, 1),
('Pro', 'For serious job seekers', 49.00, 'USD', 'monthly', 1000,
 '["1000 monthly credits", "AI features", "Priority support"]'::jsonb, true, 2),
('Ultimate', 'Maximum features', 199.00, 'USD', 'monthly', 5000,
 '["5000 monthly credits", "Everything in Pro", "Dedicated support"]'::jsonb, true, 3)
ON CONFLICT DO NOTHING;

-- Insert default credit costs
INSERT INTO "public"."credit_costs" (
    "feature_type", "feature_name", "cost", "description", "required_tier", "is_active"
) VALUES 
('job', 'search', 1, 'Search for jobs', NULL, true),
('job', 'application', 5, 'Apply to a job', NULL, true),
('analysis', 'match_score', 5, 'AI match score analysis', 'Pro', true),
('cover_letter', 'ai_generation', 5, 'Generate cover letter with AI', 'Pro', true),
('cover_letter', 'optimization', 5, 'Optimize cover letter', 'Pro', true),
('bonus', 'signup', 50, 'New user signup bonus', NULL, true)
ON CONFLICT (feature_type, feature_name) DO NOTHING;


-- ============================================================================
-- PART 3: Add subscription_tier to profiles
-- ============================================================================

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
    END IF;
END $$;


-- ============================================================================
-- PART 4: Create Helper Functions
-- ============================================================================

-- Function to check tier access
CREATE OR REPLACE FUNCTION check_tier_access(p_user_id UUID, p_required_tier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_tier TEXT;
BEGIN
    SELECT subscription_tier INTO v_user_tier FROM profiles WHERE id = p_user_id;
    IF v_user_tier IS NULL THEN v_user_tier := 'Free'; END IF;
    
    IF p_required_tier = 'Free' THEN RETURN TRUE;
    ELSIF p_required_tier = 'Pro' THEN RETURN v_user_tier IN ('Pro', 'Ultimate');
    ELSIF p_required_tier = 'Ultimate' THEN RETURN v_user_tier = 'Ultimate';
    ELSE RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user tier
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE v_tier TEXT;
BEGIN
    SELECT subscription_tier INTO v_tier FROM profiles WHERE id = p_user_id;
    RETURN COALESCE(v_tier, 'Free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume credits
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID, p_feature_type TEXT, p_feature_name TEXT, p_amount INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_cost INTEGER; v_current_balance INTEGER; v_required_tier TEXT;
    v_user_tier TEXT; v_new_balance INTEGER; v_transaction_id UUID;
BEGIN
    SELECT cost, required_tier INTO v_cost, v_required_tier
    FROM credit_costs WHERE feature_type = p_feature_type AND feature_name = p_feature_name;
    
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Feature cost not found';
    END IF;
    
    v_cost := COALESCE(p_amount, v_cost);
    
    IF v_required_tier IS NOT NULL THEN
        v_user_tier := get_user_tier(p_user_id);
        IF p_feature_type = 'analysis' AND p_feature_name = 'match_score' AND v_user_tier = 'Free' THEN
            RAISE EXCEPTION 'Match score analysis requires Pro or Ultimate';
        END IF;
        IF p_feature_type = 'cover_letter' AND v_user_tier = 'Free' THEN
            RAISE EXCEPTION 'Cover letter features require Pro or Ultimate';
        END IF;
    END IF;
    
    SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
    IF v_current_balance IS NULL THEN RAISE EXCEPTION 'User credits not found'; END IF;
    IF v_current_balance < v_cost THEN
        RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', v_cost, v_current_balance;
    END IF;
    
    v_new_balance := v_current_balance - v_cost;
    UPDATE user_credits SET balance = v_new_balance, lifetime_spent = lifetime_spent + v_cost, updated_at = NOW()
    WHERE user_id = p_user_id;
    
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
    VALUES (p_user_id, -v_cost, 'deduction', format('Used %s credits for %s: %s', v_cost, p_feature_type, p_feature_name), v_new_balance)
    RETURNING id INTO v_transaction_id;
    
    RETURN json_build_object('success', true, 'balance', v_new_balance, 'cost', v_cost, 'transaction_id', v_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PART 5: Set All Users to Free Tier with Bonuses
-- ============================================================================

-- Update all profiles to Free tier
UPDATE profiles SET subscription_tier = 'Free' WHERE subscription_tier IS NULL OR subscription_tier = '';

-- Create user_credits for users who don't have it
INSERT INTO user_credits (user_id, balance, lifetime_earned, lifetime_spent)
SELECT p.id, 60, 60, 0 FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM user_credits uc WHERE uc.user_id = p.id);

-- Add 60 credits (50 signup bonus + 10 monthly) to existing users
UPDATE user_credits uc SET 
    balance = balance + 60,
    lifetime_earned = lifetime_earned + 60,
    updated_at = NOW()
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = uc.user_id);

-- Record signup bonus transactions
INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
SELECT uc.user_id, 50, 'bonus', 'New user signup bonus - 50 credits', uc.balance - 10
FROM user_credits uc
WHERE NOT EXISTS (
    SELECT 1 FROM credit_transactions ct 
    WHERE ct.user_id = uc.user_id AND ct.transaction_type = 'bonus' AND ct.description LIKE '%signup bonus%'
);

-- Record monthly allocation transactions
INSERT INTO credit_transactions (user_id, amount, transaction_type, description, balance_after)
SELECT uc.user_id, 10, 'refill', 'Free tier monthly credit allocation - 10 credits', uc.balance
FROM user_credits uc JOIN profiles p ON uc.user_id = p.id
WHERE p.subscription_tier = 'Free'
  AND NOT EXISTS (
    SELECT 1 FROM credit_transactions ct 
    WHERE ct.user_id = uc.user_id AND ct.transaction_type = 'refill' 
    AND ct.description LIKE '%Free tier monthly%'
  );


-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
DECLARE
    total_users INTEGER; free_users INTEGER; pro_users INTEGER; 
    ultimate_users INTEGER; total_credits BIGINT; avg_credits NUMERIC;
BEGIN
    SELECT COUNT(*) INTO total_users FROM profiles;
    SELECT COUNT(*) INTO free_users FROM profiles WHERE subscription_tier = 'Free';
    SELECT COUNT(*) INTO pro_users FROM profiles WHERE subscription_tier = 'Pro';
    SELECT COUNT(*) INTO ultimate_users FROM profiles WHERE subscription_tier = 'Ultimate';
    SELECT COALESCE(SUM(balance), 0), COALESCE(AVG(balance), 0) 
    INTO total_credits, avg_credits FROM user_credits;
    
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE '   ✅ CREDIT SYSTEM DEPLOYMENT COMPLETE';
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '👥 USERS: % total (Free: %, Pro: %, Ultimate: %)', 
        total_users, free_users, pro_users, ultimate_users;
    RAISE NOTICE '💰 CREDITS: % total, %.2f average per user', total_credits, avg_credits;
    RAISE NOTICE '🎁 BONUS: 50 credits signup + 10 monthly = 60 credits per user';
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════';
END $$;

SELECT 'Deployment Complete!' as status, 
       COUNT(*) as total_users,
       SUM(balance) as total_credits
FROM user_credits;
