-- Restrict admin access to only siscostarters@gmail.com
-- This removes admin role from all users except the specified admin

-- Step 1: Remove admin role from all users
DELETE FROM public.user_roles
WHERE role = 'admin';

-- Step 2: Add admin role only to siscostarters@gmail.com
-- First, get the user_id for siscostarters@gmail.com from auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'
FROM auth.users au
WHERE au.email = 'siscostarters@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify: Show who has admin role now
-- (This won't be displayed in migration, but you can run it manually)
-- SELECT 
--   ur.user_id,
--   au.email,
--   ur.role,
--   ur.created_at
-- FROM public.user_roles ur
-- JOIN auth.users au ON au.id = ur.user_id
-- WHERE ur.role = 'admin';

COMMENT ON TABLE public.user_roles IS 'Admin access restricted to siscostarters@gmail.com';
