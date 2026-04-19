-- Run this script in the Supabase Dashboard SQL Editor
-- This trigger will automatically send an email when users create an account, log in, or change their password.

-- Ensure pg_net extension is enabled for making external HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.handle_auth_emails()
RETURNS trigger AS $$
DECLARE
  subject text;
  html text;
  req_body jsonb;
  func_url text := 'https://yquhsllwrwfvrwolqywh.supabase.co/functions/v1/send-email';
BEGIN
  -- 1. Account Created
  IF TG_OP = 'INSERT' THEN
    subject := 'Welcome to JobRaker!';
    html := '<h3>Welcome to JobRaker!</h3><p>Your account has been successfully created. We are excited to have you on board!</p>';
    
  -- 2. New Sign-in (last_sign_in_at updated)
  ELSIF TG_OP = 'UPDATE' AND OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
    subject := 'Security Alert: New sign-in detected';
    html := '<h3>New Sign-In Detected</h3><p>A new login was detected on your JobRaker account. If this was you, you can safely ignore this email.</p>';
    
  -- 3. Password Changed (encrypted_password updated)
  ELSIF TG_OP = 'UPDATE' AND OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password THEN
    subject := 'Security Alert: Password Changed';
    html := '<h3>Password Changed</h3><p>Your JobRaker password was just successfully changed. If you did not authorize this, please reset your password immediately.</p>';
    
  -- Otherwise, ignore and exit
  ELSE
    RETURN NEW;
  END IF;

  -- Build the JSON payload expected by the send-email edge function
  req_body := json_build_object(
    'to', NEW.email,
    'subject', subject,
    'html_content', html
  );

  -- Dispatch the HTTP POST request asynchronously using pg_net
  PERFORM net.http_post(
    url := func_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := req_body
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists to prevent duplicates
DROP TRIGGER IF EXISTS on_auth_email_events ON auth.users;

-- Create the trigger on the auth.users table
CREATE TRIGGER on_auth_email_events
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_emails();
