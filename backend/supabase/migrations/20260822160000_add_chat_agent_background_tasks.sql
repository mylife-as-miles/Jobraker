-- Migration: Expand job_intelligence_tasks to support chat-spawned background agents and session linking

ALTER TABLE public.job_intelligence_tasks
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_intelligence_tasks_session_id
  ON public.job_intelligence_tasks(session_id);

-- Drop old check constraint if present and recreate with all existing and new agent types
ALTER TABLE public.job_intelligence_tasks
  DROP CONSTRAINT IF EXISTS job_intelligence_tasks_type_check;

ALTER TABLE public.job_intelligence_tasks
  ADD CONSTRAINT job_intelligence_tasks_type_check CHECK (
    type IN (
      'scout_search',
      'job_reevaluation',
      'pipeline_cleanup',
      'chat_completion',
      'research_agent',
      'outreach_agent',
      'auto_apply_agent',
      'monitoring_agent',
      'custom_agent'
    )
  );

COMMENT ON COLUMN public.job_intelligence_tasks.session_id IS 'Associated chat session ID if spawned via AI Chat';
