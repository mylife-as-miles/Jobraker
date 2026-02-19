-- Create admin role system
-- This migration creates a user_roles table and updates all RLS policies to grant admins full access

-- Step 1: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles (only admins can manage roles)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Step 2: Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
    AND user_roles.role = 'admin'
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_admin IS 'Returns true if the given user_id has admin role';

-- Step 3: Update profiles RLS policies to include admin access
DROP POLICY IF EXISTS "Read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

CREATE POLICY "Users can read own profile, admins can read all"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id OR public.is_admin()
  );

CREATE POLICY "Users can insert own profile, admins can insert any"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id OR public.is_admin()
  );

CREATE POLICY "Users can update own profile, admins can update any"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id OR public.is_admin()
  );

CREATE POLICY "Admins can delete any profile"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- Step 4: Update user_credits RLS policies (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_credits') THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
    DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
    
    -- Create new policies with admin access
    CREATE POLICY "Users can view own credits, admins can view all"
      ON public.user_credits FOR SELECT
      USING (
        auth.uid() = user_id OR public.is_admin()
      );
    
    CREATE POLICY "Users can update own credits, admins can update any"
      ON public.user_credits FOR UPDATE
      USING (
        auth.uid() = user_id OR public.is_admin()
      );
    
    CREATE POLICY "Admins can insert credits"
      ON public.user_credits FOR INSERT
      WITH CHECK (public.is_admin());
    
    CREATE POLICY "Admins can delete credits"
      ON public.user_credits FOR DELETE
      USING (public.is_admin());
  END IF;
END $$;

-- Step 5: Update credit_transactions RLS policies (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_transactions') THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
    
    -- Create new policies with admin access
    CREATE POLICY "Users can view own transactions, admins can view all"
      ON public.credit_transactions FOR SELECT
      USING (
        auth.uid() = user_id OR public.is_admin()
      );
    
    CREATE POLICY "Admins can manage all transactions"
      ON public.credit_transactions FOR ALL
      USING (public.is_admin());
  END IF;
END $$;

-- Step 6: Update user_subscriptions RLS policies (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_subscriptions') THEN
    -- Drop existing policies if they exist
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
  END IF;
END $$;

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Step 8: Insert admin role for the first user (you'll need to update this with actual user ID)
-- This is commented out - you should manually assign admin role to your account
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('YOUR_USER_ID_HERE', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;

COMMENT ON TABLE public.user_roles IS 'Stores user role assignments (admin, user)';
