-- Migration: Add Starter subscription plan ($9/month, 75 credits, manual workflow, no auto-apply, no Skyvern)

-- 1. Insert Starter subscription plan into subscription_plans table
DELETE FROM public.subscription_plans WHERE name = 'Starter';

INSERT INTO public.subscription_plans (
    name,
    price,
    credits_per_month,
    description,
    sort_order,
    features,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Starter',
    9.00,
    75,
    'Designed for job seekers who want AI assistance but prefer to apply manually.',
    1,
    jsonb_build_array(
        jsonb_build_object('name', '75 monthly credits', 'value', '75', 'included', true),
        jsonb_build_object('name', 'AI job search', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'AI Chat assistant', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Resume analysis', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Resume builder', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'AI resume polishing', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Cover-letter generation', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Job match scores', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Application tracking', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Recruiter outreach message generation', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Manual application workflow', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'No auto-apply', 'value', 'No auto-apply', 'included', false),
        jsonb_build_object('name', 'No Skyvern usage', 'value', 'No Skyvern', 'included', false)
    ),
    true,
    NOW(),
    NOW()
);

-- Normalize sort orders
UPDATE public.subscription_plans SET sort_order = 0 WHERE name = 'Free';
UPDATE public.subscription_plans SET sort_order = 1 WHERE name = 'Starter';
UPDATE public.subscription_plans SET sort_order = 2 WHERE name = 'Basics';
UPDATE public.subscription_plans SET sort_order = 3 WHERE name = 'Pro';
UPDATE public.subscription_plans SET sort_order = 4 WHERE name = 'Ultimate';

-- 2. Update profiles check constraint to permit Starter
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_tier_check 
    CHECK (subscription_tier IN ('Free', 'Starter', 'Basics', 'Pro', 'Professional', 'Ultimate', 'Executive', 'Enterprise', 'Team'));

-- 3. Update public.normalize_tier helper function
CREATE OR REPLACE FUNCTION public.normalize_tier(p_tier TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE COALESCE(p_tier, '')
        WHEN 'Starter' THEN 'Starter'
        WHEN 'Starter Plan' THEN 'Starter'
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

-- 4. Update public.check_tier_access RPC
CREATE OR REPLACE FUNCTION public.check_tier_access(
    p_user_id uuid,
    p_required_tier text
) RETURNS boolean AS $$
DECLARE
    v_user_tier text;
    v_tier_rank integer;
    v_required_rank integer;
BEGIN
    v_user_tier := public.get_user_tier(p_user_id);

    v_tier_rank := CASE public.normalize_tier(v_user_tier)
        WHEN 'Free' THEN 0
        WHEN 'Starter' THEN 1
        WHEN 'Basics' THEN 2
        WHEN 'Pro' THEN 3
        WHEN 'Ultimate' THEN 4
        ELSE 0
    END;

    v_required_rank := CASE public.normalize_tier(p_required_tier)
        WHEN 'Free' THEN 0
        WHEN 'Starter' THEN 1
        WHEN 'Basics' THEN 2
        WHEN 'Pro' THEN 3
        WHEN 'Ultimate' THEN 4
        ELSE 0
    END;

    RETURN v_tier_rank >= v_required_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.normalize_tier(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_tier_access(uuid, text) TO authenticated, service_role;
