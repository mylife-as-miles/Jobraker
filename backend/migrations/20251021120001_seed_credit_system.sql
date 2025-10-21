-- Insert default subscription plans and credit costs
-- This sets up the initial credit system configuration

-- Insert subscription tier plans (monthly recurring with application limits)
INSERT INTO "public"."subscription_plans" (
    "name", "description", "price", "currency", "billing_cycle", "credits_per_cycle", 
    "features", "is_active", "sort_order"
) VALUES 
-- FREE - Job Seeker Explorer
(
    'Job Seeker Explorer',
    'Perfect for casual job searching and exploring opportunities',
    0.00,
    'USD',
    'monthly',
    5,
    '["Basic job search", "Resume storage", "Application tracking", "Community support"]'::jsonb,
    true,
    1
),
-- HOBBY - Weekend Searcher
(
    'Weekend Searcher',
    'Ideal for weekend job hunters and part-time seekers',
    9.00,
    'USD',
    'monthly',
    15,
    '["Everything in Explorer", "AI resume tips", "Basic cover letter templates", "Email support"]'::jsonb,
    true,
    2
),
-- STARTER - Active Job Seeker
(
    'Active Job Seeker',
    'For those actively searching and applying regularly',
    29.00,
    'USD',
    'monthly',
    50,
    '["Everything in Weekend", "AI resume optimization", "Custom cover letters", "Interview preparation", "Priority support"]'::jsonb,
    true,
    3
),
-- GROWTH - Career Changer
(
    'Career Changer',
    'Perfect for career transitions and comprehensive job searches',
    69.00,
    'USD',
    'monthly',
    100,
    '["Everything in Active", "Career transition tools", "Skills gap analysis", "Industry insights", "Personal job coach"]'::jsonb,
    true,
    4
),
-- PRO - Aggressive Applicant
(
    'Aggressive Applicant',
    'For serious job seekers who apply frequently and need advanced tools',
    149.00,
    'USD',
    'monthly',
    300,
    '["Everything in Career Changer", "Advanced analytics", "Bulk application tools", "Custom branding", "API access"]'::jsonb,
    true,
    5
),
-- SCALE - Professional Powerhouse
(
    'Professional Powerhouse',
    'For power users and recruiters managing high-volume applications',
    299.00,
    'USD',
    'monthly',
    750,
    '["Everything in Aggressive", "Team collaboration", "Advanced reporting", "White-label options", "Dedicated account manager"]'::jsonb,
    true,
    6
),
-- ULTIMATE - Enterprise Unlimited
(
    'Enterprise Unlimited',
    'Maximum features for enterprise users and high-volume professionals',
    599.00,
    'USD',
    'monthly',
    2000,
    '["Everything in Professional", "Unlimited team members", "Custom integrations", "24/7 phone support", "SLA guarantee"]'::jsonb,
    true,
    7
),
-- ENTERPRISE - Custom Solutions
(
    'Custom Solutions',
    'Tailored enterprise solutions with custom pricing and features',
    0.00,
    'USD',
    'yearly',
    10000,
    '["Custom feature development", "Dedicated infrastructure", "Enterprise security", "Custom SLA", "On-premise deployment options"]'::jsonb,
    true,
    8
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