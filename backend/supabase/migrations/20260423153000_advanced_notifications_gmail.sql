-- Advanced notifications: richer metadata/source model, Gmail-specific preferences,
-- archive support, and dedupe keys for system-wide producers.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS source_record_id uuid,
  ADD COLUMN IF NOT EXISTS source_record_type text,
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.notifications
SET source = CASE
  WHEN type = 'credit' THEN 'billing'
  WHEN type IN ('job_search', 'company') THEN 'job_search'
  WHEN type IN ('application', 'interview') THEN 'application'
  ELSE 'system'
END
WHERE source IS NULL OR source = 'system';

ALTER TABLE public.notifications
  ALTER COLUMN source SET DEFAULT 'system',
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('interview', 'application', 'system', 'company', 'job_search', 'credit'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_source_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_check
  CHECK (source IN ('system', 'gmail', 'automation', 'application', 'job_search', 'billing'));

CREATE INDEX IF NOT EXISTS idx_notifications_user_source_created
  ON public.notifications(user_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_archived_created
  ON public.notifications(user_id, archived_at, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe_key
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON COLUMN public.notifications.source IS
  'High-level producer/source for the notification such as gmail, automation, billing, or job_search.';
COMMENT ON COLUMN public.notifications.source_record_id IS
  'Optional UUID of the source record that created this notification.';
COMMENT ON COLUMN public.notifications.source_record_type IS
  'Logical source record type such as application, gmail_event, or provider_run.';
COMMENT ON COLUMN public.notifications.action_label IS
  'Optional CTA label shown in the notification center.';
COMMENT ON COLUMN public.notifications.metadata IS
  'Structured metadata rendered in the notification center and used for future automations.';
COMMENT ON COLUMN public.notifications.dedupe_key IS
  'Stable key used to suppress duplicate notifications from retries/replays.';
COMMENT ON COLUMN public.notifications.archived_at IS
  'Timestamp when the notification was archived from the notification center.';

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS notify_job_search boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_credit_updates boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_gmail_updates boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_job_search boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_credit_updates boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_gmail_updates boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_job_search boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_credit_updates boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_gmail_updates boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS gmail_auto_sync_enabled boolean DEFAULT true;

UPDATE public.notification_settings
SET
  notify_job_search = COALESCE(notify_job_search, job_alerts, true),
  notify_credit_updates = COALESCE(notify_credit_updates, true),
  notify_gmail_updates = COALESCE(notify_gmail_updates, application_updates, true),
  email_job_search = COALESCE(email_job_search, false),
  email_credit_updates = COALESCE(email_credit_updates, email_notifications, true),
  email_gmail_updates = COALESCE(email_gmail_updates, email_applications, email_notifications, true),
  push_job_search = COALESCE(push_job_search, push_notifications, true),
  push_credit_updates = COALESCE(push_credit_updates, push_notifications, true),
  push_gmail_updates = COALESCE(push_gmail_updates, push_applications, push_notifications, true),
  gmail_auto_sync_enabled = COALESCE(gmail_auto_sync_enabled, true);

COMMENT ON COLUMN public.notification_settings.notify_job_search IS
  'Enable in-app notifications for job discovery and source scans.';
COMMENT ON COLUMN public.notification_settings.notify_credit_updates IS
  'Enable in-app notifications for billing and credit changes.';
COMMENT ON COLUMN public.notification_settings.notify_gmail_updates IS
  'Enable Gmail-derived application notifications in the notification center.';
COMMENT ON COLUMN public.notification_settings.email_job_search IS
  'Reserved for future email delivery of job-search notifications.';
COMMENT ON COLUMN public.notification_settings.email_credit_updates IS
  'Reserved for future email delivery of billing notifications.';
COMMENT ON COLUMN public.notification_settings.email_gmail_updates IS
  'Reserved for future email delivery of Gmail-derived notifications.';
COMMENT ON COLUMN public.notification_settings.push_job_search IS
  'Reserved for future push delivery of job-search notifications.';
COMMENT ON COLUMN public.notification_settings.push_credit_updates IS
  'Reserved for future push delivery of billing notifications.';
COMMENT ON COLUMN public.notification_settings.push_gmail_updates IS
  'Reserved for future push delivery of Gmail-derived notifications.';
COMMENT ON COLUMN public.notification_settings.gmail_auto_sync_enabled IS
  'Automatically refresh Gmail-derived application notifications when opening the notification center.';
