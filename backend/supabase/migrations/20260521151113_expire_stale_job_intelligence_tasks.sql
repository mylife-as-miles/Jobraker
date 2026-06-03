-- Expire task rows that were left active by abandoned browser sessions or failed
-- async flows before the client-side stale-task guard existed.
UPDATE public.job_intelligence_tasks
SET
  status = 'failed',
  message = 'Task timed out after no progress. Retry to run it again.',
  completed_at = timezone('utc'::text, now()),
  updated_at = timezone('utc'::text, now())
WHERE status IN ('queued', 'running')
  AND updated_at < timezone('utc'::text, now()) - interval '10 minutes';
