-- Add new "Basics" subscription plan
-- $14/month - 20 job searches, 200 credits, AI cover letter, AI match score (no AI assistant)

-- First check if subscription_plans table exists, if not skip this migration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_plans') THEN
        -- Check if Basics plan already exists
        IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE name = 'Basics') THEN
            -- Insert the Basics plan into subscription_plans
            INSERT INTO public.subscription_plans (
                name,
                description,
                price,
                currency,
                billing_cycle,
                credits_per_month,
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
            );

            -- Update sort order for existing plans to accommodate Basics
            UPDATE public.subscription_plans
            SET sort_order = 2, updated_at = NOW()
            WHERE name = 'Pro';

            UPDATE public.subscription_plans
            SET sort_order = 3, updated_at = NOW()
            WHERE name = 'Ultimate';

            RAISE NOTICE '=== Basics Plan Added ===';
            RAISE NOTICE 'Basics plan created with $14.00/month price and 200 credits';
        ELSE
            RAISE NOTICE 'Basics plan already exists, skipping creation';
        END IF;
    ELSE
        RAISE NOTICE 'subscription_plans table does not exist, skipping Basics plan creation';
    END IF;
END $$;
