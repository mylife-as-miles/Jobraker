-- Insert default subscription plans and credit costs
-- This sets up the initial credit system configuration

-- Insert credit pack plans (one-time purchases with higher margins)
INSERT INTO "public"."subscription_plans" (
    "name", "description", "price", "currency", "billing_cycle", "credits_per_cycle", 
    "features", "is_active", "sort_order"
) VALUES 
-- Mini Pack - 10 credits for $7 (2.3x markup)
(
    'Mini Pack',
    '10 credits for quick job search tasks - Perfect for trying our premium features',
    7.00,
    'USD',
    'lifetime',
    10,
    '["Basic job search", "Resume storage", "Application tracking", "AI assistance"]'::jsonb,
    true,
    1
),
-- Starter Pack - 25 credits for $16 (2.1x markup)
(
    'Starter Pack',
    '25 credits for regular job seekers - Great for active searching',
    16.00,
    'USD',
    'lifetime',
    25,
    '["Advanced job search", "AI resume optimization", "Cover letter generation", "Interview preparation", "Priority support"]'::jsonb,
    true,
    2
),
-- Value Pack - 75 credits for $42 (1.9x markup) - BEST VALUE
(
    'Value Pack',
    '75 credits - Best value for serious job seekers! Save 33% compared to smaller packs',
    42.00,
    'USD',
    'lifetime',
    75,
    '["Everything in Starter", "Advanced analytics", "Custom branding", "ATS optimization", "Salary insights", "Market analysis"]'::jsonb,
    true,
    3
),
-- Power Pack - 200 credits for $99 (1.7x markup)
(
    'Power Pack',
    '200 credits for heavy users - Ideal for comprehensive job search campaigns',
    99.00,
    'USD',
    'lifetime',
    200,
    '["Everything in Value", "Priority processing", "API access", "Advanced integrations", "Dedicated support", "Bulk operations"]'::jsonb,
    true,
    4
),
-- Mega Pack - 500 credits for $225 (1.5x markup)
(
    'Mega Pack',
    '500 credits - Maximum value for power users and teams',
    225.00,
    'USD',
    'lifetime',
    500,
    '["Everything in Power", "Team collaboration", "Admin dashboard", "White labeling", "Custom workflows", "24/7 support"]'::jsonb,
    true,
    5
)
ON CONFLICT DO NOTHING;

-- Insert default credit costs for various features
INSERT INTO "public"."credit_costs" (
    "feature_type", "feature_name", "cost", "description", "is_active"
) VALUES 
-- Job search and application features
('job_search', 'auto_apply', 5, 'Automatically apply to a job using AI', true),
('job_search', 'job_match_analysis', 2, 'AI analysis of job match compatibility', true),
('job_search', 'salary_analysis', 1, 'Get salary insights for a job posting', true),

-- Resume features
('resume', 'ai_optimization', 10, 'AI-powered resume optimization and enhancement', true),
('resume', 'ats_analysis', 3, 'Analyze resume compatibility with ATS systems', true),
('resume', 'skill_suggestions', 2, 'Get AI suggestions for improving resume skills', true),

-- Cover letter features
('cover_letter', 'ai_generation', 5, 'Generate personalized cover letter using AI', true),
('cover_letter', 'optimization', 3, 'Optimize existing cover letter for specific job', true),

-- Interview preparation
('interview', 'mock_interview', 8, 'AI-powered mock interview session', true),
('interview', 'question_practice', 2, 'Practice common interview questions', true),
('interview', 'company_research', 3, 'Automated research about target company', true),

-- Analytics and insights
('analytics', 'application_insights', 1, 'Detailed analytics about application performance', true),
('analytics', 'market_analysis', 5, 'Job market analysis and trends', true),

-- Communication features
('communication', 'follow_up_generator', 2, 'Generate follow-up emails and messages', true),
('communication', 'networking_message', 2, 'Generate networking and outreach messages', true),

-- Premium features
('premium', 'priority_support', 0, 'Access to priority customer support', true),
('premium', 'advanced_filtering', 0, 'Advanced job search filters and sorting', true)
ON CONFLICT (feature_type, feature_name) DO NOTHING;

-- Function to initialize user credits when a user signs up
CREATE OR REPLACE FUNCTION "public"."initialize_user_credits"()
RETURNS TRIGGER AS $$
BEGIN
    -- Create credit record for new user with free tier credits
    INSERT INTO "public"."user_credits" (
        "user_id", 
        "balance", 
        "total_earned", 
        "last_reset_at"
    ) VALUES (
        NEW.id,
        50, -- Free tier credits
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
        'Welcome credits for new user',
        'signup_bonus'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically initialize credits for new users
CREATE OR REPLACE TRIGGER "initialize_user_credits_trigger"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."initialize_user_credits"();

-- Function to allocate subscription credits
CREATE OR REPLACE FUNCTION "public"."allocate_subscription_credits"(
    p_user_id uuid,
    p_plan_id uuid
) RETURNS void AS $$
DECLARE
    v_credits_to_add integer;
    v_current_balance integer;
    v_plan_name text;
BEGIN
    -- Get credit allocation from subscription plan
    SELECT credits_per_cycle, name 
    INTO v_credits_to_add, v_plan_name
    FROM subscription_plans 
    WHERE id = p_plan_id AND is_active = true;
    
    IF v_credits_to_add IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive subscription plan';
    END IF;
    
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM user_credits 
    WHERE user_id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        -- Initialize credits if not exists
        INSERT INTO user_credits (user_id, balance, total_earned, last_reset_at)
        VALUES (p_user_id, v_credits_to_add, v_credits_to_add, timezone('utc'::text, now()));
        v_current_balance := 0;
    ELSE
        -- Update existing credits
        UPDATE user_credits 
        SET 
            balance = balance + v_credits_to_add,
            total_earned = total_earned + v_credits_to_add,
            last_reset_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE user_id = p_user_id;
    END IF;
    
    -- Record transaction
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        reference_type,
        reference_id
    ) VALUES (
        p_user_id,
        'earned',
        v_credits_to_add,
        v_current_balance,
        v_current_balance + v_credits_to_add,
        format('Monthly credit allocation for %s plan', v_plan_name),
        'subscription',
        p_plan_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume credits for a feature
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
BEGIN
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
        p_metadata
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;