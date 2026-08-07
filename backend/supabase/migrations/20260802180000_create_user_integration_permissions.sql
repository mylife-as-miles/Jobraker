-- Create user_integration_permissions table for App/Integration First-Use Consent
CREATE TABLE IF NOT EXISTS public.user_integration_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_slug TEXT NOT NULL,
  permission_scope TEXT NOT NULL DEFAULT 'allow_always', -- 'allow_always', 'allow_once'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, integration_slug)
);

ALTER TABLE public.user_integration_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_integration_permissions'
      AND policyname = 'Users manage own integration permissions'
  ) THEN
    CREATE POLICY "Users manage own integration permissions" ON public.user_integration_permissions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT ALL ON TABLE public.user_integration_permissions TO authenticated, service_role;
