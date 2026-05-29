-- 20260529100000_async_background_tasks.sql
-- Durable background task queue processing on Supabase

-- 1. Drop check constraint on type to allow any task types (chat, tailor, search, etc.)
ALTER TABLE public.job_intelligence_tasks 
  DROP CONSTRAINT IF EXISTS job_intelligence_tasks_type_check;

-- 2. Add retry and timing columns to job_intelligence_tasks
ALTER TABLE public.job_intelligence_tasks 
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS run_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

-- 3. Create or replace trigger function to call the process-task Edge Function
CREATE OR REPLACE FUNCTION public.trigger_process_task()
RETURNS trigger AS $$
DECLARE
  project_url text;
  service_role_key text;
  req_id bigint;
  auth_header text;
BEGIN
  -- Only trigger if status is 'queued' and run_at is now or in the past
  IF NEW.status = 'queued' AND (NEW.run_at IS NULL OR NEW.run_at <= now()) THEN
    -- Retrieve project_url and key
    SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name = 'project_url';
    SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
    
    IF service_role_key IS NULL THEN
      SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'anon_key';
    END IF;

    -- Local/Kong fallback
    IF project_url IS NULL THEN
      project_url := 'http://kong:8000';
    END IF;

    IF service_role_key IS NULL THEN
      -- If nothing is in the vault, we still try to run but without a token
      auth_header := 'Bearer SYSTEM_TRIGGER';
    ELSE
      auth_header := 'Bearer ' || service_role_key;
    END IF;

    -- Call the edge function process-task asynchronously using pg_net
    SELECT net.http_post(
      url := project_url || '/functions/v1/process-task',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', auth_header
      ),
      body := jsonb_build_object('taskId', NEW.id)
    ) INTO req_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trigger_job_intelligence_task_process ON public.job_intelligence_tasks;
CREATE TRIGGER trigger_job_intelligence_task_process
  AFTER INSERT OR UPDATE OF status, run_at ON public.job_intelligence_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_process_task();

-- 5. Setup pg_cron job to poll and trigger scheduled/delayed tasks
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-tasks-cron');
EXCEPTION WHEN OTHERS THEN
  -- ignore if it didn't exist
  NULL;
END;$$;

SELECT cron.schedule(
  'process-scheduled-tasks-cron',
  '* * * * *', -- every minute
  $$
  -- Update updated_at of queued tasks whose run_at is in the past, to trigger the trigger
  UPDATE public.job_intelligence_tasks
  SET updated_at = now()
  WHERE status = 'queued' 
    AND run_at <= now()
    -- avoid double triggering if it was just touched/updated
    AND updated_at < now() - interval '30 seconds';
  $$
);
