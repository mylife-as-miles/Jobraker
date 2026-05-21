-- Durable task registry for Scout/search, re-evaluation, and cleanup workflows.

CREATE TABLE IF NOT EXISTS public.job_intelligence_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  title text NOT NULL,
  message text,
  progress_current integer NOT NULL DEFAULT 0,
  progress_total integer NOT NULL DEFAULT 0,
  cancel_requested boolean NOT NULL DEFAULT false,
  retry_of uuid REFERENCES public.job_intelligence_tasks(id) ON DELETE SET NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT job_intelligence_tasks_type_check CHECK (
    type IN ('scout_search', 'job_reevaluation', 'pipeline_cleanup')
  ),
  CONSTRAINT job_intelligence_tasks_status_check CHECK (
    status IN ('queued', 'running', 'completed', 'failed', 'canceled')
  ),
  CONSTRAINT job_intelligence_tasks_progress_check CHECK (
    progress_current >= 0 AND progress_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS job_intelligence_tasks_user_created_idx
  ON public.job_intelligence_tasks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS job_intelligence_tasks_user_status_idx
  ON public.job_intelligence_tasks (user_id, status, updated_at DESC);

ALTER TABLE public.job_intelligence_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own job intelligence tasks, admins can view all" ON public.job_intelligence_tasks;
CREATE POLICY "Users can view own job intelligence tasks, admins can view all"
  ON public.job_intelligence_tasks FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own job intelligence tasks" ON public.job_intelligence_tasks;
CREATE POLICY "Users can insert own job intelligence tasks"
  ON public.job_intelligence_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own job intelligence tasks" ON public.job_intelligence_tasks;
CREATE POLICY "Users can update own job intelligence tasks"
  ON public.job_intelligence_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own job intelligence tasks" ON public.job_intelligence_tasks;
CREATE POLICY "Users can delete own job intelligence tasks"
  ON public.job_intelligence_tasks FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_intelligence_tasks TO authenticated;
GRANT ALL ON TABLE public.job_intelligence_tasks TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.job_intelligence_tasks;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END IF;
END $$;
