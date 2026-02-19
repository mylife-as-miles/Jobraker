
-- Create a test user in auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone, phone_confirmed_at, confirmation_token, confirmation_sent_at, is_sso_user)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test@example.com', crypt('password', gen_salt('bf')), NOW(), '', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), null, null, '', null, false);

-- Seed public profile for the test user
INSERT INTO public.profiles (id, first_name, last_name, job_title, subscription_tier) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test', 'User', 'Developer', 'Pro');
