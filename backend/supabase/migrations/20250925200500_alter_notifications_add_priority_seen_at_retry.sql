-- Retry migration to add priority & seen_at columns to notifications (ensures execution)
DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS priority text CHECK (priority in ('low','medium','high')) DEFAULT 'medium';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS seen_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_priority ON public.notifications(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unseen ON public.notifications(user_id) WHERE seen_at IS NULL;

COMMENT ON COLUMN public.notifications.priority IS 'Relative importance of the notification';
COMMENT ON COLUMN public.notifications.seen_at IS 'Timestamp when user viewed notification detail pane';
