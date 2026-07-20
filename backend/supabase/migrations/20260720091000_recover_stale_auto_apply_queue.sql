-- Ensure the queue processor wakes up for both newly waiting work and stale
-- claimed/worker-handoff rows that require bounded recovery.

DO $unschedule$
BEGIN
  PERFORM cron.unschedule('process-auto-apply-queue-cron');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$unschedule$;

SELECT cron.schedule(
  'process-auto-apply-queue-cron',
  '* * * * *',
  $cron$
    SELECT public.invoke_process_auto_apply_queue('cron', NULL)
    WHERE EXISTS (
      SELECT 1
      FROM public.applications AS application
      WHERE application.canonical_stage = 'queued'
        AND (
          application.provider_status = 'waiting'
          OR (
            application.provider_status = 'launching'
            AND application.updated_at < now() - interval '10 minutes'
          )
          OR (
            application.provider_status = 'waiting_worker'
            AND application.updated_at < now() - interval '3 hours'
          )
        )
    );
  $cron$
);
