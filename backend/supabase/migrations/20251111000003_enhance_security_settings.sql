-- Enhance security_settings table with advanced security features
-- Add enterprise-level security options

-- Add new columns to security_settings if they don't exist
DO $$ 
BEGIN
  -- Advanced 2FA settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'require_2fa_for_login') THEN
    ALTER TABLE public.security_settings ADD COLUMN require_2fa_for_login boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'backup_codes_required') THEN
    ALTER TABLE public.security_settings ADD COLUMN backup_codes_required boolean DEFAULT true;
  END IF;
  
  -- Login security
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'login_alerts_enabled') THEN
    ALTER TABLE public.security_settings ADD COLUMN login_alerts_enabled boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'suspicious_login_alerts') THEN
    ALTER TABLE public.security_settings ADD COLUMN suspicious_login_alerts boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'password_change_alerts') THEN
    ALTER TABLE public.security_settings ADD COLUMN password_change_alerts boolean DEFAULT true;
  END IF;
  
  -- Session management
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'session_timeout_minutes') THEN
    ALTER TABLE public.security_settings ADD COLUMN session_timeout_minutes integer DEFAULT 60;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'max_concurrent_sessions') THEN
    ALTER TABLE public.security_settings ADD COLUMN max_concurrent_sessions integer DEFAULT 5;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'auto_logout_inactive') THEN
    ALTER TABLE public.security_settings ADD COLUMN auto_logout_inactive boolean DEFAULT true;
  END IF;
  
  -- IP Security
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'ip_whitelist_enabled') THEN
    ALTER TABLE public.security_settings ADD COLUMN ip_whitelist_enabled boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'allowed_ips') THEN
    ALTER TABLE public.security_settings ADD COLUMN allowed_ips text[] DEFAULT ARRAY[]::text[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'blocked_ips') THEN
    ALTER TABLE public.security_settings ADD COLUMN blocked_ips text[] DEFAULT ARRAY[]::text[];
  END IF;
  
  -- API Security
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'api_keys_enabled') THEN
    ALTER TABLE public.security_settings ADD COLUMN api_keys_enabled boolean DEFAULT false;
  END IF;
  
  -- Enterprise features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'sso_enabled') THEN
    ALTER TABLE public.security_settings ADD COLUMN sso_enabled boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'sso_provider') THEN
    ALTER TABLE public.security_settings ADD COLUMN sso_provider text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'security_questions_enabled') THEN
    ALTER TABLE public.security_settings ADD COLUMN security_questions_enabled boolean DEFAULT false;
  END IF;
  
  -- Password policy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'password_min_length') THEN
    ALTER TABLE public.security_settings ADD COLUMN password_min_length integer DEFAULT 8;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'password_require_uppercase') THEN
    ALTER TABLE public.security_settings ADD COLUMN password_require_uppercase boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'password_require_lowercase') THEN
    ALTER TABLE public.security_settings ADD COLUMN password_require_lowercase boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'password_require_numbers') THEN
    ALTER TABLE public.security_settings ADD COLUMN password_require_numbers boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'password_require_symbols') THEN
    ALTER TABLE public.security_settings ADD COLUMN password_require_symbols boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_settings' AND column_name = 'password_expiry_days') THEN
    ALTER TABLE public.security_settings ADD COLUMN password_expiry_days integer DEFAULT 0; -- 0 = no expiry
  END IF;
END $$;

-- Create active_sessions table for session management
CREATE TABLE IF NOT EXISTS public.security_active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  device_id text,
  device_name text,
  device_type text, -- 'desktop', 'mobile', 'tablet', 'unknown'
  browser text,
  os text,
  ip_address inet,
  location text, -- City, Country
  user_agent text,
  is_current boolean DEFAULT false,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(user_id, session_token)
);

CREATE INDEX IF NOT EXISTS idx_security_active_sessions_user_id ON public.security_active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_active_sessions_token ON public.security_active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_security_active_sessions_expires ON public.security_active_sessions(expires_at);

ALTER TABLE public.security_active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own active sessions"
  ON public.security_active_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own active sessions"
  ON public.security_active_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own active sessions"
  ON public.security_active_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own active sessions"
  ON public.security_active_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Create security_audit_log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'login', 'logout', 'password_change', '2fa_enabled', '2fa_disabled', 'session_revoked', 'ip_blocked', etc.
  event_description text,
  ip_address inet,
  user_agent text,
  device_id text,
  location text,
  risk_level text DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON public.security_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON public.security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_risk_level ON public.security_audit_log(risk_level);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own audit log"
  ON public.security_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Create API keys table
CREATE TABLE IF NOT EXISTS public.security_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  key_hash text NOT NULL UNIQUE, -- SHA-256 hash of the actual key
  key_prefix text NOT NULL, -- First 8 chars for display
  last_used_at timestamptz,
  expires_at timestamptz,
  ip_restrictions text[], -- Allowed IPs
  permissions text[], -- Scopes/permissions
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_api_keys_user_id ON public.security_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_security_api_keys_hash ON public.security_api_keys(key_hash);

ALTER TABLE public.security_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own API keys"
  ON public.security_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own API keys"
  ON public.security_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own API keys"
  ON public.security_api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own API keys"
  ON public.security_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Create security_questions table
CREATE TABLE IF NOT EXISTS public.security_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer_hash text NOT NULL, -- SHA-256 hash
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_questions_user_id ON public.security_questions(user_id);

ALTER TABLE public.security_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own security questions"
  ON public.security_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own security questions"
  ON public.security_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own security questions"
  ON public.security_questions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own security questions"
  ON public.security_questions FOR DELETE
  USING (auth.uid() = user_id);

-- Update existing rows with defaults
UPDATE public.security_settings
SET 
  require_2fa_for_login = COALESCE(require_2fa_for_login, false),
  backup_codes_required = COALESCE(backup_codes_required, true),
  login_alerts_enabled = COALESCE(login_alerts_enabled, sign_in_alerts),
  suspicious_login_alerts = COALESCE(suspicious_login_alerts, true),
  password_change_alerts = COALESCE(password_change_alerts, true),
  session_timeout_minutes = COALESCE(session_timeout_minutes, 60),
  max_concurrent_sessions = COALESCE(max_concurrent_sessions, 5),
  auto_logout_inactive = COALESCE(auto_logout_inactive, true),
  ip_whitelist_enabled = COALESCE(ip_whitelist_enabled, false),
  allowed_ips = COALESCE(allowed_ips, ARRAY[]::text[]),
  blocked_ips = COALESCE(blocked_ips, ARRAY[]::text[]),
  api_keys_enabled = COALESCE(api_keys_enabled, false),
  sso_enabled = COALESCE(sso_enabled, false),
  security_questions_enabled = COALESCE(security_questions_enabled, false),
  password_min_length = COALESCE(password_min_length, 8),
  password_require_uppercase = COALESCE(password_require_uppercase, true),
  password_require_lowercase = COALESCE(password_require_lowercase, true),
  password_require_numbers = COALESCE(password_require_numbers, true),
  password_require_symbols = COALESCE(password_require_symbols, true),
  password_expiry_days = COALESCE(password_expiry_days, 0)
WHERE 
  require_2fa_for_login IS NULL 
  OR backup_codes_required IS NULL;

-- Add comments
COMMENT ON COLUMN public.security_settings.require_2fa_for_login IS 'Require 2FA for all login attempts';
COMMENT ON COLUMN public.security_settings.backup_codes_required IS 'Require backup codes to be generated before enabling 2FA';
COMMENT ON COLUMN public.security_settings.login_alerts_enabled IS 'Send alerts for login events';
COMMENT ON COLUMN public.security_settings.suspicious_login_alerts IS 'Send alerts for suspicious login patterns';
COMMENT ON COLUMN public.security_settings.password_change_alerts IS 'Send alerts when password is changed';
COMMENT ON COLUMN public.security_settings.session_timeout_minutes IS 'Session timeout in minutes (0 = no timeout)';
COMMENT ON COLUMN public.security_settings.max_concurrent_sessions IS 'Maximum number of concurrent sessions allowed';
COMMENT ON COLUMN public.security_settings.auto_logout_inactive IS 'Automatically logout inactive sessions';
COMMENT ON COLUMN public.security_settings.ip_whitelist_enabled IS 'Enable IP whitelist restrictions';
COMMENT ON COLUMN public.security_settings.allowed_ips IS 'Array of allowed IP addresses';
COMMENT ON COLUMN public.security_settings.blocked_ips IS 'Array of blocked IP addresses';
COMMENT ON COLUMN public.security_settings.api_keys_enabled IS 'Enable API key management';
COMMENT ON COLUMN public.security_settings.sso_enabled IS 'Enable Single Sign-On';
COMMENT ON COLUMN public.security_settings.sso_provider IS 'SSO provider name (e.g., Google, Microsoft, Okta)';

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_active_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_api_keys;

