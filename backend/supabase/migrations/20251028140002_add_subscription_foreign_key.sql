-- Add missing foreign key constraint between user_subscriptions and subscription_plans
-- This fixes the PostgREST error about missing relationship

DO $$
BEGIN
    -- Check if both tables exist
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_subscriptions')
       AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_plans') THEN
        
        -- Check if the foreign key already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'user_subscriptions_subscription_plan_id_fkey'
        ) THEN
            -- Add foreign key constraint
            -- First check which column name is used (plan_id vs subscription_plan_id)
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'user_subscriptions' 
                AND column_name = 'subscription_plan_id'
            ) THEN
                ALTER TABLE public.user_subscriptions
                ADD CONSTRAINT user_subscriptions_subscription_plan_id_fkey
                FOREIGN KEY (subscription_plan_id)
                REFERENCES public.subscription_plans(id)
                ON DELETE CASCADE;
                
                RAISE NOTICE 'Added foreign key constraint: user_subscriptions.subscription_plan_id -> subscription_plans.id';
            ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'user_subscriptions' 
                AND column_name = 'plan_id'
            ) THEN
                ALTER TABLE public.user_subscriptions
                ADD CONSTRAINT user_subscriptions_plan_id_fkey
                FOREIGN KEY (plan_id)
                REFERENCES public.subscription_plans(id)
                ON DELETE CASCADE;
                
                RAISE NOTICE 'Added foreign key constraint: user_subscriptions.plan_id -> subscription_plans.id';
            ELSE
                RAISE NOTICE 'Could not find plan_id or subscription_plan_id column in user_subscriptions';
            END IF;
        ELSE
            RAISE NOTICE 'Foreign key constraint already exists';
        END IF;
    ELSE
        RAISE NOTICE 'One or both tables do not exist, skipping foreign key creation';
    END IF;
END $$;
