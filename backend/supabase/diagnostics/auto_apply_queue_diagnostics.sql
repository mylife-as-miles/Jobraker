-- Auto Apply queue diagnostics
-- Run in the Supabase SQL editor as a database administrator. This script does
-- not print Vault secret values or authorization headers.

-- Required Vault secret names and whether each is configured.
SELECT
  name,
  decrypted_secret IS NOT NULL
    AND length(trim(decrypted_secret)) > 0 AS configured
FROM vault.decrypted_secrets
WHERE name IN ('project_url', 'service_role_key', 'anon_key')
ORDER BY name;

-- Active queue function definitions and restrictive function configuration.
SELECT
  n.nspname AS schema_name,
  p.proname,
  p.proconfig,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'invoke_process_auto_apply_queue',
    'trigger_process_auto_apply_queue',
    'acquire_next_auto_apply_jobs',
    'upsert_job_from_discovery'
  )
ORDER BY p.proname, p.oid;

-- Trigger binding and enabled state on applications.
SELECT
  t.tgname AS trigger_name,
  t.tgenabled,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger AS t
WHERE t.tgrelid = 'public.applications'::regclass
  AND t.tgname = 'trigger_auto_apply_queue_process'
  AND NOT t.tgisinternal;

-- Fallback cron schedule and command.
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'process-auto-apply-queue-cron';

-- Recent cron execution outcomes.
SELECT
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid
  FROM cron.job
  WHERE jobname = 'process-auto-apply-queue-cron'
)
ORDER BY start_time DESC
LIMIT 20;

-- Recent pg_net outcomes. Response IDs correlate with the invocation log below.
SELECT
  id AS request_id,
  status_code,
  timed_out,
  error_msg,
  content,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 20;

-- Requests still waiting to be sent by pg_net.
SELECT
  id AS request_id,
  method,
  url,
  timeout_milliseconds
FROM net.http_request_queue
ORDER BY id DESC
LIMIT 20;

-- Request-to-target correlation. URLs contain no query strings or secrets.
SELECT
  id,
  request_id,
  function_name,
  url,
  source,
  application_id,
  created_at
FROM public.edge_function_invocation_log
ORDER BY created_at DESC
LIMIT 50;

-- Applications eligible for the next automatic queue run.
SELECT
  id,
  user_id,
  job_id,
  provider_status,
  canonical_stage,
  retry_count,
  created_at,
  updated_at
FROM public.applications
WHERE canonical_stage = 'queued'
  AND provider_status = 'waiting'
ORDER BY created_at ASC
LIMIT 50;
