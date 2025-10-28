-- Add Basics to profiles subscription_tier check constraint
-- This allows the Basics tier to be set in the profiles table

DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_subscription_tier_check'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_subscription_tier_check;
        RAISE NOTICE 'Dropped old subscription_tier check constraint';
    END IF;

    -- Add new constraint that includes Basics
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_tier_check 
    CHECK (subscription_tier IN ('Free', 'Basics', 'Pro', 'Ultimate'));

    RAISE NOTICE 'Added new subscription_tier check constraint with Basics tier';
END $$;
