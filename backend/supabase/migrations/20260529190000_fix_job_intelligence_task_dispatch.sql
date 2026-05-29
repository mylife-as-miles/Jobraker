-- Ensure queued job intelligence tasks are actually re-dispatched by cron.
--
-- The original scheduled job only updated updated_at. The dispatch trigger is
-- defined as UPDATE OF status, run_at, so those cron touches did not invoke
-- process-task for stuck queued rows.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-tasks-cron');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'process-scheduled-tasks-cron',
  '* * * * *',
  $$
  UPDATE public.job_intelligence_tasks
  SET
    run_at = run_at,
    updated_at = timezone('utc'::text, now())
  WHERE status = 'queued'
    AND run_at <= timezone('utc'::text, now())
    AND updated_at < timezone('utc'::text, now()) - interval '30 seconds';
  $$
);
