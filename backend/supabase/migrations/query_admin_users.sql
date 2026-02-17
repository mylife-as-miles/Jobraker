-- Query to see all users with admin role
-- This shows which accounts have been assigned admin access

SELECT 
  ur.user_id,
  ur.role,
  p.first_name,
  p.last_name,
  ur.created_at
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at;
