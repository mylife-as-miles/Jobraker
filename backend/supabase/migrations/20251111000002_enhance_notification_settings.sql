-- Enhance notification_settings table to be more granular and aligned with application notification types
-- Add type-specific settings and improve defaults

-- First, add new columns if they don't exist
DO $$ 
BEGIN
  -- Add type-specific notification settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_interviews') THEN
    ALTER TABLE public.notification_settings ADD COLUMN notify_interviews boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_applications') THEN
    ALTER TABLE public.notification_settings ADD COLUMN notify_applications boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_system') THEN
    ALTER TABLE public.notification_settings ADD COLUMN notify_system boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_company_updates') THEN
    ALTER TABLE public.notification_settings ADD COLUMN notify_company_updates boolean DEFAULT true;
  END IF;
  
  -- Add more granular email settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'email_interviews') THEN
    ALTER TABLE public.notification_settings ADD COLUMN email_interviews boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'email_applications') THEN
    ALTER TABLE public.notification_settings ADD COLUMN email_applications boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'email_system') THEN
    ALTER TABLE public.notification_settings ADD COLUMN email_system boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'email_company_updates') THEN
    ALTER TABLE public.notification_settings ADD COLUMN email_company_updates boolean DEFAULT true;
  END IF;
  
  -- Add push notification granular settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'push_interviews') THEN
    ALTER TABLE public.notification_settings ADD COLUMN push_interviews boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'push_applications') THEN
    ALTER TABLE public.notification_settings ADD COLUMN push_applications boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'push_system') THEN
    ALTER TABLE public.notification_settings ADD COLUMN push_system boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'push_company_updates') THEN
    ALTER TABLE public.notification_settings ADD COLUMN push_company_updates boolean DEFAULT true;
  END IF;
  
  -- Add quiet hours settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'quiet_hours_enabled') THEN
    ALTER TABLE public.notification_settings ADD COLUMN quiet_hours_enabled boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'quiet_hours_start') THEN
    ALTER TABLE public.notification_settings ADD COLUMN quiet_hours_start time DEFAULT '22:00:00';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'quiet_hours_end') THEN
    ALTER TABLE public.notification_settings ADD COLUMN quiet_hours_end time DEFAULT '08:00:00';
  END IF;
  
  -- Add sound settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'sound_enabled') THEN
    ALTER TABLE public.notification_settings ADD COLUMN sound_enabled boolean DEFAULT true;
  END IF;
  
  -- Add desktop notification settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'desktop_notifications') THEN
    ALTER TABLE public.notification_settings ADD COLUMN desktop_notifications boolean DEFAULT true;
  END IF;
END $$;

-- Update existing rows to have default values for new columns
UPDATE public.notification_settings
SET 
  notify_interviews = COALESCE(notify_interviews, true),
  notify_applications = COALESCE(notify_applications, true),
  notify_system = COALESCE(notify_system, true),
  notify_company_updates = COALESCE(notify_company_updates, true),
  email_interviews = COALESCE(email_interviews, email_notifications),
  email_applications = COALESCE(email_applications, email_notifications),
  email_system = COALESCE(email_system, false),
  email_company_updates = COALESCE(email_company_updates, email_notifications),
  push_interviews = COALESCE(push_interviews, push_notifications),
  push_applications = COALESCE(push_applications, push_notifications),
  push_system = COALESCE(push_system, false),
  push_company_updates = COALESCE(push_company_updates, push_notifications),
  quiet_hours_enabled = COALESCE(quiet_hours_enabled, false),
  quiet_hours_start = COALESCE(quiet_hours_start, '22:00:00'::time),
  quiet_hours_end = COALESCE(quiet_hours_end, '08:00:00'::time),
  sound_enabled = COALESCE(sound_enabled, true),
  desktop_notifications = COALESCE(desktop_notifications, true)
WHERE 
  notify_interviews IS NULL 
  OR notify_applications IS NULL 
  OR notify_system IS NULL 
  OR notify_company_updates IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.notification_settings.notify_interviews IS 'Enable/disable in-app notifications for interview-related updates';
COMMENT ON COLUMN public.notification_settings.notify_applications IS 'Enable/disable in-app notifications for application-related updates';
COMMENT ON COLUMN public.notification_settings.notify_system IS 'Enable/disable in-app notifications for system messages';
COMMENT ON COLUMN public.notification_settings.notify_company_updates IS 'Enable/disable in-app notifications for company updates';
COMMENT ON COLUMN public.notification_settings.email_interviews IS 'Send email notifications for interview-related updates';
COMMENT ON COLUMN public.notification_settings.email_applications IS 'Send email notifications for application-related updates';
COMMENT ON COLUMN public.notification_settings.email_system IS 'Send email notifications for system messages';
COMMENT ON COLUMN public.notification_settings.email_company_updates IS 'Send email notifications for company updates';
COMMENT ON COLUMN public.notification_settings.push_interviews IS 'Send push notifications for interview-related updates';
COMMENT ON COLUMN public.notification_settings.push_applications IS 'Send push notifications for application-related updates';
COMMENT ON COLUMN public.notification_settings.push_system IS 'Send push notifications for system messages';
COMMENT ON COLUMN public.notification_settings.push_company_updates IS 'Send push notifications for company updates';
COMMENT ON COLUMN public.notification_settings.quiet_hours_enabled IS 'Enable quiet hours to suppress notifications during specified time';
COMMENT ON COLUMN public.notification_settings.quiet_hours_start IS 'Start time for quiet hours (24-hour format)';
COMMENT ON COLUMN public.notification_settings.quiet_hours_end IS 'End time for quiet hours (24-hour format)';
COMMENT ON COLUMN public.notification_settings.sound_enabled IS 'Play sound when receiving notifications';
COMMENT ON COLUMN public.notification_settings.desktop_notifications IS 'Show desktop/browser notifications';

