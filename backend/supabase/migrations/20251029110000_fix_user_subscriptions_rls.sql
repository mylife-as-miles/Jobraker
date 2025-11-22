-- Fix RLS policies for user_subscriptions table
-- This ensures admins can view all subscriptions

DO $$
BEGIN
  -- Only proceed if the table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_subscriptions') THEN
    
    -- Enable RLS if not already enabled
    ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own subscriptions, admins can view all" ON public.user_subscriptions;
    DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;
    DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;

    -- Create new policies with admin access
    CREATE POLICY "Users can view own subscriptions, admins can view all"
      ON public.user_subscriptions FOR SELECT
      USING (
        auth.uid() = user_id OR public.is_admin()
      );

    CREATE POLICY "Admins can manage all subscriptions"
      ON public.user_subscriptions FOR ALL
      USING (public.is_admin());

    RAISE NOTICE 'Updated RLS policies for user_subscriptions table';
  ELSE
    RAISE NOTICE 'user_subscriptions table does not exist, skipping RLS update';
  END IF;
END $$;
