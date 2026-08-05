-- Allow chat turns to use the existing durable task queue.
-- Earlier queue migrations already remove this constraint in newer databases;
-- keeping this idempotent makes the chat handoff safe on older projects too.
ALTER TABLE public.job_intelligence_tasks
  DROP CONSTRAINT IF EXISTS job_intelligence_tasks_type_check;

CREATE INDEX IF NOT EXISTS job_intelligence_tasks_chat_completion_idx
  ON public.job_intelligence_tasks (user_id, status, created_at DESC)
  WHERE type = 'chat_completion';
