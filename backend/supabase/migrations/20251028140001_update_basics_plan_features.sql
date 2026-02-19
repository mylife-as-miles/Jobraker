-- Update Basics plan to include Auto Apply (since it's in Free tier)
-- All Free tier features should be included in Basics

UPDATE public.subscription_plans
SET 
    features = jsonb_build_array(
        jsonb_build_object('name', 'Job Searches', 'value', '20 per month', 'included', true),
        jsonb_build_object('name', 'Credits', 'value', '200 per month', 'included', true),
        jsonb_build_object('name', 'AI Cover Letter', 'value', 'Unlimited', 'included', true),
        jsonb_build_object('name', 'AI Match Score', 'value', 'Enabled', 'included', true),
        jsonb_build_object('name', 'Auto Apply', 'value', 'Included', 'included', true),
        jsonb_build_object('name', 'Resume Storage', 'value', 'Unlimited', 'included', true),
        jsonb_build_object('name', 'Application Tracking', 'value', 'Full access', 'included', true),
        jsonb_build_object('name', 'Email Notifications', 'value', 'Enabled', 'included', true),
        jsonb_build_object('name', 'AI Assistant', 'value', 'Not included', 'included', false)
    ),
    description = 'Essential features for active job seekers - includes all Free tier features plus more credits',
    updated_at = NOW()
WHERE name = 'Basics';

-- Verify the update
DO $$
DECLARE
    basics_features JSONB;
BEGIN
    SELECT features INTO basics_features FROM public.subscription_plans WHERE name = 'Basics';
    
    RAISE NOTICE '=== Basics Plan Updated ===';
    RAISE NOTICE 'Auto Apply is now included in Basics tier';
    RAISE NOTICE 'All Free tier features are included';
    RAISE NOTICE 'Features: %', basics_features;
    RAISE NOTICE '==========================';
END $$;
