-- Migration to grant admin role to ezeagwujohnpaul@gmail.com
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'ezeagwujohnpaul@gmail.com';

  IF target_user_id IS NOT NULL THEN
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Admin role granted to %', target_user_id;
  ELSE
    RAISE WARNING 'User with email ezeagwujohnpaul@gmail.com not found';
  END IF;
END $$;
