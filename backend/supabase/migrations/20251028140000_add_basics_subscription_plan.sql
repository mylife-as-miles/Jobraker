-- Add new "Basics" subscription plan
-- $14/month - 20 job searches, 200 credits, AI cover letter, AI match score (no AI assistant)

-- Insert the Basics plan into subscription_plans
INSERT INTO public.subscription_plans (
    name,
    description,
    price,
    currency,
    billing_cycle,
    credits_per_cycle,
    features,
    is_active,
    sort_order
)
VALUES (
    'Basics',
    'Essential features for active job seekers',
    14.00,
    'USD',
    'monthly',
    200,
    jsonb_build_array(
        jsonb_build_object('name', 'Job Searches', 'value', '20 per month', 'included', true),
        jsonb_build_object('name', 'Credits', 'value', '200 per month', 'included', true),
        jsonb_build_object('name', 'AI Cover Letter', 'value', 'Unlimited', 'included', true),
        jsonb_build_object('name', 'AI Match Score', 'value', 'Enabled', 'included', true),
        jsonb_build_object('name', 'AI Assistant', 'value', 'Not included', 'included', false),
        jsonb_build_object('name', 'Auto Apply', 'value', 'Coming soon', 'included', false)
    ),
    true,
    1 -- Sort order: Free=0, Basics=1, Pro=2, Ultimate=3
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    credits_per_cycle = EXCLUDED.credits_per_cycle,
    features = EXCLUDED.features,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Update sort order for existing plans to accommodate Basics
UPDATE public.subscription_plans
SET sort_order = 2, updated_at = NOW()
WHERE name = 'Pro';

UPDATE public.subscription_plans
SET sort_order = 3, updated_at = NOW()
WHERE name = 'Ultimate';

-- Verify the new plan was created
DO $$
DECLARE
    plan_count INTEGER;
    basics_plan_id UUID;
BEGIN
    -- Count total plans
    SELECT COUNT(*) INTO plan_count FROM public.subscription_plans WHERE is_active = true;
    
    -- Get Basics plan ID
    SELECT id INTO basics_plan_id FROM public.subscription_plans WHERE name = 'Basics';
    
    -- Log the result
    RAISE NOTICE '=== Basics Plan Added ===';
    RAISE NOTICE 'Total active plans: %', plan_count;
    RAISE NOTICE 'Basics plan ID: %', basics_plan_id;
    RAISE NOTICE 'Basics plan price: $14.00/month';
    RAISE NOTICE 'Basics plan credits: 200 per month';
    RAISE NOTICE '========================';
END $$;
