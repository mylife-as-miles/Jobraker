-- Migrate roles system to support creator role and admin sub-roles (owner, editor, reader)

-- 1. Modify public.user_roles table constraint to support 'creator'
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'user', 'creator'));

-- 2. Add admin_sub_role column to public.user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS admin_sub_role text;

-- 3. Add check constraint on admin_sub_role to allow only 'owner', 'editor', 'reader' for admin, and enforce NULL for others.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_admin_sub_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_admin_sub_role_check 
  CHECK (
    (role = 'admin' AND admin_sub_role IN ('owner', 'editor', 'reader')) OR
    (role != 'admin' AND admin_sub_role IS NULL)
  );

-- 4. Migrate existing admins to 'owner'
-- Update siscostarters@gmail.com
UPDATE public.user_roles
SET admin_sub_role = 'owner'
WHERE role = 'admin' AND user_id IN (
  SELECT id FROM auth.users WHERE email = 'siscostarters@gmail.com'
);

-- Update ezeagwujohnpaul@gmail.com
UPDATE public.user_roles
SET admin_sub_role = 'owner'
WHERE role = 'admin' AND user_id IN (
  SELECT id FROM auth.users WHERE email = 'ezeagwujohnpaul@gmail.com'
);

-- Default any other admin rows (if any) to 'owner' to prevent lockout in dev/test
UPDATE public.user_roles
SET admin_sub_role = 'owner'
WHERE role = 'admin' AND admin_sub_role IS NULL;

-- 5. Create SQL Helper Functions with SECURITY DEFINER and search_path set to public
CREATE OR REPLACE FUNCTION public.get_admin_sub_role(user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT admin_sub_role
    FROM public.user_roles
    WHERE user_roles.user_id = get_admin_sub_role.user_id
      AND user_roles.role = 'admin'
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_owner(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin_owner.user_id
      AND user_roles.role = 'admin'
      AND user_roles.admin_sub_role = 'owner'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_editor(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin_editor.user_id
      AND user_roles.role = 'admin'
      AND user_roles.admin_sub_role IN ('owner', 'editor')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_reader(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin_reader.user_id
      AND user_roles.role = 'admin'
      AND user_roles.admin_sub_role IN ('owner', 'editor', 'reader')
  );
END;
$$;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.get_admin_sub_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_sub_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_editor(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_reader(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_reader(uuid) TO service_role;

-- 6. Update user_roles policies to only allow owners to write
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_admin_owner());

DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE
  USING (public.is_admin_owner())
  WITH CHECK (public.is_admin_owner());

DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  USING (public.is_admin_owner());

-- 7. Update other write/update policies for other tables (user_credits, user_subscriptions, credit_transactions, provider_credit_balances, provider_credit_transactions)

-- For user_credits:
DROP POLICY IF EXISTS "Users can update own credits, admins can update any" ON public.user_credits;
CREATE POLICY "Users can update own credits, admins can update any"
  ON public.user_credits FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin_editor());

DROP POLICY IF EXISTS "Admins can insert credits" ON public.user_credits;
CREATE POLICY "Admins can insert credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (public.is_admin_editor());

DROP POLICY IF EXISTS "Admins can delete credits" ON public.user_credits;
CREATE POLICY "Admins can delete credits"
  ON public.user_credits FOR DELETE
  USING (public.is_admin_editor());

-- For credit_transactions:
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.credit_transactions;
CREATE POLICY "Admins can manage all transactions"
  ON public.credit_transactions FOR ALL
  USING (public.is_admin_editor());

-- For user_subscriptions:
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (public.is_admin_editor());

-- For provider_credit_balances:
DROP POLICY IF EXISTS "Admins can manage provider credit balances" ON public.provider_credit_balances;
CREATE POLICY "Admins can manage provider credit balances"
  ON public.provider_credit_balances FOR ALL
  USING (public.is_admin_editor())
  WITH CHECK (public.is_admin_editor());

-- For provider_credit_transactions:
DROP POLICY IF EXISTS "Admins can manage provider credit transactions" ON public.provider_credit_transactions;
CREATE POLICY "Admins can manage provider credit transactions"
  ON public.provider_credit_transactions FOR ALL
  USING (public.is_admin_editor())
  WITH CHECK (public.is_admin_editor());
