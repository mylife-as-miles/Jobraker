-- Gmail connection metadata and classified mailbox events for application tracking.

CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  scope text[] NOT NULL DEFAULT '{}'::text[],
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  sync_history_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gmail_connections_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.gmail_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmail_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  event_type text NOT NULL,
  status text,
  confidence numeric(5,2) NOT NULL DEFAULT 0,
  company text,
  job_title text,
  sender_name text,
  sender_email text,
  subject text,
  snippet text,
  received_at timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gmail_application_events_event_type_check
    CHECK (event_type IN ('application_confirmation', 'interview', 'offer', 'rejection', 'assessment', 'other')),
  CONSTRAINT gmail_application_events_status_check
    CHECK (status IS NULL OR status IN ('Applied', 'Interview', 'Offer', 'Rejected')),
  CONSTRAINT gmail_application_events_user_message_key UNIQUE (user_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS gmail_connections_user_updated_idx
  ON public.gmail_connections (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS gmail_oauth_states_user_expires_idx
  ON public.gmail_oauth_states (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS gmail_application_events_user_received_idx
  ON public.gmail_application_events (user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS gmail_application_events_application_idx
  ON public.gmail_application_events (application_id, received_at DESC);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_application_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own Gmail application events" ON public.gmail_application_events;
CREATE POLICY "Users can view their own Gmail application events"
  ON public.gmail_application_events FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.gmail_connections FROM anon, authenticated;
REVOKE ALL ON public.gmail_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.gmail_application_events FROM anon, authenticated;

GRANT SELECT ON public.gmail_application_events TO authenticated;
GRANT ALL ON public.gmail_connections TO service_role;
GRANT ALL ON public.gmail_oauth_states TO service_role;
GRANT ALL ON public.gmail_application_events TO service_role;

COMMENT ON TABLE public.gmail_connections IS
  'Encrypted Gmail OAuth tokens and connection metadata. Access is reserved for service-role edge functions.';

COMMENT ON TABLE public.gmail_application_events IS
  'Gmail messages classified as application lifecycle events such as confirmations, interviews, offers, and rejections.';
