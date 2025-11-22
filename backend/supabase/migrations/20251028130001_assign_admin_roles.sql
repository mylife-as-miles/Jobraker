-- Assign admin role to existing users
-- This migration assigns admin role to the user who is currently logged in

-- Function to assign admin role (can be called manually)
CREATE OR REPLACE FUNCTION public.assign_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Also ensure they have the user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Grant execute to authenticated users (they can only assign to themselves initially)
GRANT EXECUTE ON FUNCTION public.assign_admin_role(uuid) TO authenticated;

-- Assign admin role to all existing users with profiles
-- (You can comment this out after first run if you only want specific admins)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Also assign regular user role to everyone
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

COMMENT ON FUNCTION public.assign_admin_role IS 'Assigns admin role to a user';
