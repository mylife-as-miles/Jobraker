-- Mirrors backend/supabase/migrations/20260421153000_gmail_events_withdrawal.sql
-- Allow withdrawal lifecycle in gmail_application_events (event_type + status).

ALTER TABLE public.gmail_application_events
  DROP CONSTRAINT IF EXISTS gmail_application_events_event_type_check;

ALTER TABLE public.gmail_application_events
  ADD CONSTRAINT gmail_application_events_event_type_check
  CHECK (
    event_type IN (
      'application_confirmation',
      'interview',
      'offer',
      'rejection',
      'assessment',
      'withdrawal',
      'other'
    )
  );

ALTER TABLE public.gmail_application_events
  DROP CONSTRAINT IF EXISTS gmail_application_events_status_check;

ALTER TABLE public.gmail_application_events
  ADD CONSTRAINT gmail_application_events_status_check
  CHECK (
    status IS NULL
    OR status IN ('Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn')
  );
