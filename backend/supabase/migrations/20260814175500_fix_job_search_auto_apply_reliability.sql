-- Fix JobRaker scheduled job discovery and Auto Apply billing/state reliability.
--
-- 1. Replace the legacy anon-key jobs-cron pg_cron request with a dedicated
--    service-role-only scheduled Edge Function.
-- 2. Enforce the commercial Auto Apply price of 10 credits per application at
--    the authoritative reservation + settlement boundary, including callers
--    that still estimate 5 credits per application.
-- 3. Prevent provider runs from becoming "Applied/submitted" before the
--    provider actually reports completion.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Scheduled job discovery dispatch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invoke_jobs_cron_scheduled()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_project_url text;
  v_service_role_key text;
  v_base_url text;
  v_target_url text;
  v_request_id bigint;
BEGIN
  SELECT NULLIF(btrim(v.decrypted_secret), '')
  INTO v_project_url
  FROM vault.decrypted_secrets AS v
  WHERE v.name = 'project_url'
  LIMIT 1;

  SELECT NULLIF(btrim(v.decrypted_secret), '')
  INTO v_service_role_key
  FROM vault.decrypted_secrets AS v
  WHERE v.name = 'service_role_key'
  LIMIT 1;

  IF v_project_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Scheduled job discovery skipped: Vault secrets project_url/service_role_key are missing';
    RETURN NULL;
  END IF;

  v_base_url := regexp_replace(v_project_url, '/+$', '');
  v_base_url := regexp_replace(v_base_url, '/functions/v1$', '', 'i');

  IF v_base_url !~ '^https?://[^[:space:]?#]+$' THEN
    RAISE WARNING 'Scheduled job discovery skipped: project_url Vault secret is invalid';
    RETURN NULL;
  END IF;

  v_target_url := v_base_url || '/functions/v1/jobs-cron-scheduled';

  SELECT net.http_post(
    url := v_target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('scheduled_trigger', true),
    timeout_milliseconds := 30000
  )
  INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Scheduled job discovery invocation failed (SQLSTATE %): %', SQLSTATE, SQLERRM;
    RETURN NULL;
END;
$function$;

-- Remove the obsolete hourly job that called jobs-cron using a browser/anon key.
DO $unschedule$
BEGIN
  PERFORM cron.unschedule('invoke-jobs-cron-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$unschedule$;

DO $unschedule$
BEGIN
  PERFORM cron.unschedule('invoke-jobs-cron-scheduled');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$unschedule$;

-- Match the product's default background-search cadence: every six hours.
SELECT cron.schedule(
  'invoke-jobs-cron-scheduled',
  '5 */6 * * *',
  $$ SELECT public.invoke_jobs_cron_scheduled(); $$
);

REVOKE ALL ON FUNCTION public.invoke_jobs_cron_scheduled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_jobs_cron_scheduled() TO service_role;

-- ---------------------------------------------------------------------------
-- Auto Apply reservation: 10 credits/application
-- ---------------------------------------------------------------------------
--
-- The current Edge Function may still estimate 5 credits per application.
-- Rename the existing implementation and place a compatibility wrapper in
-- front of it. The wrapper raises the reservation to 10 credits/application
-- using metadata.job_urls when available, while remaining safe for future
-- callers that already send the correct 10-credit estimate.

ALTER FUNCTION public.reserve_credits_for_run(uuid, text, integer, text, jsonb)
  RENAME TO reserve_credits_for_run_base_20260814;

CREATE OR REPLACE FUNCTION public.reserve_credits_for_run(
  p_user_id uuid,
  p_run_type text,
  p_estimated_credits integer,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_effective_estimate integer := GREATEST(COALESCE(p_estimated_credits, 0), 0);
  v_job_count integer := 0;
BEGIN
  IF p_run_type = 'auto_apply' THEN
    IF jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)->'job_urls') = 'array' THEN
      v_job_count := jsonb_array_length(COALESCE(p_metadata, '{}'::jsonb)->'job_urls');
    END IF;

    -- Compatibility fallback for old callers that estimated 5 credits/job.
    IF v_job_count <= 0 THEN
      v_job_count := GREATEST(
        1,
        CEIL(GREATEST(COALESCE(p_estimated_credits, 0), 1)::numeric / 5.0)::integer
      );
    END IF;

    v_effective_estimate := GREATEST(v_effective_estimate, v_job_count * 10);
    p_metadata := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'credits_per_auto_apply', 10,
      'auto_apply_job_count', v_job_count,
      'caller_estimated_credits', p_estimated_credits,
      'effective_estimated_credits', v_effective_estimate
    );
  END IF;

  RETURN public.reserve_credits_for_run_base_20260814(
    p_user_id,
    p_run_type,
    v_effective_estimate,
    p_idempotency_key,
    p_metadata
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_credits_for_run(uuid, text, integer, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits_for_run(uuid, text, integer, text, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.reserve_credits_for_run_base_20260814(uuid, text, integer, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits_for_run_base_20260814(uuid, text, integer, text, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Auto Apply settlement: 10 credits for each successfully completed app
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_and_settle_agent_run(
  p_agent_run_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_total_apps integer;
  v_terminal_apps integer;
  v_successful_apps integer;
  v_actual_credits integer;
  v_status text;
  v_result json;
BEGIN
  SELECT COUNT(*)
  INTO v_total_apps
  FROM public.applications
  WHERE agent_run_id = p_agent_run_id;

  IF v_total_apps = 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No applications found for this run'
    );
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE canonical_stage NOT IN ('failed', 'terminated', 'draft_ready', 'queued')
    )
  INTO v_terminal_apps, v_successful_apps
  FROM public.applications
  WHERE agent_run_id = p_agent_run_id
    AND canonical_stage IN (
      'submitted', 'failed', 'terminated', 'interview', 'offer', 'rejected', 'withdrawn'
    );

  IF v_terminal_apps = v_total_apps THEN
    v_actual_credits := v_successful_apps * 10;

    IF v_successful_apps = v_total_apps THEN
      v_status := 'completed';
    ELSIF v_successful_apps = 0 THEN
      v_status := 'failed';
    ELSE
      v_status := 'completed';
    END IF;

    v_result := public.settle_run_credits(
      p_agent_run_id := p_agent_run_id,
      p_actual_credits := v_actual_credits,
      p_status := v_status,
      p_failure_reason := CASE
        WHEN v_successful_apps = 0 THEN 'All applications failed'
        ELSE NULL
      END,
      p_receipt := jsonb_build_object(
        'total_applications', v_total_apps,
        'successful_applications', v_successful_apps,
        'failed_applications', v_total_apps - v_successful_apps,
        'credits_per_successful_application', 10
      )
    );

    RETURN v_result;
  END IF;

  RETURN json_build_object(
    'success', false,
    'message', 'Not all applications are terminal',
    'total_applications', v_total_apps,
    'terminal_applications', v_terminal_apps
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.check_and_settle_agent_run(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_settle_agent_run(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Provider state normalization
-- ---------------------------------------------------------------------------
-- A provider accepting a run only means automation is in progress. Keep it in
-- Pending/queued until the provider webhook reports a terminal completion.

CREATE OR REPLACE FUNCTION public.normalize_running_application_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF lower(COALESCE(NEW.provider_status, '')) = 'running'
     AND lower(COALESCE(NEW.automation_provider, '')) IN ('rtrvr', 'skyvern') THEN
    NEW.status := 'Pending';
    NEW.canonical_stage := 'queued';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_running_application_state_trigger
  ON public.applications;

CREATE TRIGGER normalize_running_application_state_trigger
BEFORE INSERT OR UPDATE OF provider_status, automation_provider, status, canonical_stage
ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.normalize_running_application_state();

REVOKE ALL ON FUNCTION public.normalize_running_application_state()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_running_application_state()
  TO service_role;
