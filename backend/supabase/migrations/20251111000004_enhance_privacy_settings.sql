-- Enhance privacy_settings table with enterprise features
ALTER TABLE public.privacy_settings
  ADD COLUMN IF NOT EXISTS allow_location_sharing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_activity_tracking boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_third_party_sharing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_cookie_tracking boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_retention_days integer DEFAULT 365,
  ADD COLUMN IF NOT EXISTS auto_delete_inactive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_marketing_emails boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_analytics_cookies boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_functional_cookies boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_advertising_cookies boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gdpr_consent_given boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gdpr_consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS allow_data_portability boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_data_deletion boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_with_recruiters boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_profile_search boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_application_status boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_company_access boolean DEFAULT false;

-- Update existing rows with defaults
UPDATE public.privacy_settings
SET 
  allow_location_sharing = COALESCE(allow_location_sharing, false),
  allow_activity_tracking = COALESCE(allow_activity_tracking, true),
  allow_third_party_sharing = COALESCE(allow_third_party_sharing, false),
  allow_cookie_tracking = COALESCE(allow_cookie_tracking, true),
  data_retention_days = COALESCE(data_retention_days, 365),
  auto_delete_inactive = COALESCE(auto_delete_inactive, false),
  allow_marketing_emails = COALESCE(allow_marketing_emails, false),
  allow_analytics_cookies = COALESCE(allow_analytics_cookies, true),
  allow_functional_cookies = COALESCE(allow_functional_cookies, true),
  allow_advertising_cookies = COALESCE(allow_advertising_cookies, false),
  gdpr_consent_given = COALESCE(gdpr_consent_given, false),
  allow_data_portability = COALESCE(allow_data_portability, true),
  allow_data_deletion = COALESCE(allow_data_deletion, true),
  share_with_recruiters = COALESCE(share_with_recruiters, false),
  allow_profile_search = COALESCE(allow_profile_search, true),
  show_application_status = COALESCE(show_application_status, true),
  allow_company_access = COALESCE(allow_company_access, false)
WHERE 
  allow_location_sharing IS NULL 
  OR allow_activity_tracking IS NULL;

-- Create privacy_audit_log table
CREATE TABLE IF NOT EXISTS public.privacy_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'setting_changed', 'data_exported', 'data_deleted', 'consent_given', 'consent_withdrawn', 'gdpr_request'
  setting_name text,
  old_value text,
  new_value text,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_audit_log_user_id ON public.privacy_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_log_action_type ON public.privacy_audit_log(action_type);

ALTER TABLE public.privacy_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Read own privacy audit log" ON public.privacy_audit_log;
DROP POLICY IF EXISTS "Insert own privacy audit log" ON public.privacy_audit_log;

CREATE POLICY "Read own privacy audit log"
  ON public.privacy_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own privacy audit log"
  ON public.privacy_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create data deletion requests table
CREATE TABLE IF NOT EXISTS public.privacy_data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL, -- 'full_deletion', 'partial_deletion', 'anonymization'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  requested_data_types text[], -- ['profile', 'applications', 'resumes', 'notifications', etc.]
  reason text,
  scheduled_deletion_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_deletion_requests_user_id ON public.privacy_data_deletion_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_deletion_requests_status ON public.privacy_data_deletion_requests(status);

ALTER TABLE public.privacy_data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Read own deletion requests" ON public.privacy_data_deletion_requests;
DROP POLICY IF EXISTS "Insert own deletion requests" ON public.privacy_data_deletion_requests;
DROP POLICY IF EXISTS "Update own deletion requests" ON public.privacy_data_deletion_requests;

CREATE POLICY "Read own deletion requests"
  ON public.privacy_data_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own deletion requests"
  ON public.privacy_data_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own deletion requests"
  ON public.privacy_data_deletion_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for new tables (ignore if already added)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'privacy_audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.privacy_audit_log;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'privacy_data_deletion_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.privacy_data_deletion_requests;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.privacy_settings.allow_location_sharing IS 'Allow sharing location data';
COMMENT ON COLUMN public.privacy_settings.allow_activity_tracking IS 'Track user activity for analytics';
COMMENT ON COLUMN public.privacy_settings.allow_third_party_sharing IS 'Share data with third-party services';
COMMENT ON COLUMN public.privacy_settings.allow_cookie_tracking IS 'Allow cookie-based tracking';
COMMENT ON COLUMN public.privacy_settings.data_retention_days IS 'Number of days to retain user data (0 = indefinite)';
COMMENT ON COLUMN public.privacy_settings.auto_delete_inactive IS 'Automatically delete data for inactive accounts';
COMMENT ON COLUMN public.privacy_settings.allow_marketing_emails IS 'Allow marketing and promotional emails';
COMMENT ON COLUMN public.privacy_settings.allow_analytics_cookies IS 'Allow analytics cookies';
COMMENT ON COLUMN public.privacy_settings.allow_functional_cookies IS 'Allow functional cookies';
COMMENT ON COLUMN public.privacy_settings.allow_advertising_cookies IS 'Allow advertising cookies';
COMMENT ON COLUMN public.privacy_settings.gdpr_consent_given IS 'User has given GDPR consent';
COMMENT ON COLUMN public.privacy_settings.gdpr_consent_date IS 'Date when GDPR consent was given';
COMMENT ON COLUMN public.privacy_settings.allow_data_portability IS 'Allow data export/portability';
COMMENT ON COLUMN public.privacy_settings.allow_data_deletion IS 'Allow data deletion requests';
COMMENT ON COLUMN public.privacy_settings.share_with_recruiters IS 'Share profile with recruiters';
COMMENT ON COLUMN public.privacy_settings.allow_profile_search IS 'Allow profile to appear in search results';
COMMENT ON COLUMN public.privacy_settings.show_application_status IS 'Show application status to companies';
COMMENT ON COLUMN public.privacy_settings.allow_company_access IS 'Allow companies to access profile data';

