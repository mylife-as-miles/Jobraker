-- Harden database-triggered dispatch for the Auto Apply queue.
--
-- This migration intentionally replaces the active trigger and cron definitions
-- without editing their historical migrations.

CREATE TABLE IF NOT EXISTS public.edge_function_invocation_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id bigint NOT NULL,
  function_name text NOT NULL,
  url text NOT NULL,
  source text NOT NULL,
  application_id uuid NULL REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edge_function_invocation_log_function_name_check
    CHECK (function_name = 'process-auto-apply-queue'),
  CONSTRAINT edge_function_invocation_log_source_check
    CHECK (source IN ('trigger', 'cron'))
);

CREATE UNIQUE INDEX IF NOT EXISTS edge_function_invocation_log_request_id_idx
  ON public.edge_function_invocation_log (request_id);

CREATE INDEX IF NOT EXISTS edge_function_invocation_log_function_created_at_idx
  ON public.edge_function_invocation_log (function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS edge_function_invocation_log_application_created_at_idx
  ON public.edge_function_invocation_log (application_id, created_at DESC)
  WHERE application_id IS NOT NULL;

ALTER TABLE public.edge_function_invocation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_function_invocation_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.edge_function_invocation_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.edge_function_invocation_log TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_process_auto_apply_queue(
  p_source text,
  p_application_id uuid DEFAULT NULL
)
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
  IF p_source IS NULL OR p_source NOT IN ('trigger', 'cron') THEN
    RAISE EXCEPTION 'Unsupported Auto Apply queue invocation source: %', p_source
      USING ERRCODE = '22023';
  END IF;

  SELECT NULLIF(btrim(v.decrypted_secret), '')
  INTO v_project_url
  FROM vault.decrypted_secrets AS v
  WHERE v.name = 'project_url'
  LIMIT 1;

  IF v_project_url IS NULL THEN
    RAISE WARNING 'Auto Apply queue invocation skipped from %: Vault secret project_url is missing or empty', p_source;
    RETURN NULL;
  END IF;

  SELECT NULLIF(btrim(v.decrypted_secret), '')
  INTO v_service_role_key
  FROM vault.decrypted_secrets AS v
  WHERE v.name = 'service_role_key'
  LIMIT 1;

  IF v_service_role_key IS NULL THEN
    RAISE WARNING 'Auto Apply queue invocation skipped from %: Vault secret service_role_key is missing or empty', p_source;
    RETURN NULL;
  END IF;

  -- Accept a project root or a function base URL, but always dispatch to one
  -- canonical /functions/v1/process-auto-apply-queue target.
  v_base_url := regexp_replace(v_project_url, '/+$', '');
  v_base_url := regexp_replace(v_base_url, '/functions/v1$', '', 'i');

  IF v_base_url !~ '^https?://[^[:space:]?#]+$' THEN
    RAISE WARNING 'Auto Apply queue invocation skipped from %: Vault secret project_url is not a valid HTTP(S) base URL', p_source;
    RETURN NULL;
  END IF;

  v_target_url := v_base_url || '/functions/v1/process-auto-apply-queue';

  SELECT net.http_post(
    url := v_target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  INTO v_request_id;

  IF v_request_id IS NULL THEN
    RAISE WARNING 'Auto Apply queue invocation from % did not receive a pg_net request ID', p_source;
    RETURN NULL;
  END IF;

  INSERT INTO public.edge_function_invocation_log (
    request_id,
    function_name,
    url,
    source,
    application_id
  ) VALUES (
    v_request_id,
    'process-auto-apply-queue',
    v_target_url,
    p_source,
    p_application_id
  );

  RETURN v_request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Auto Apply queue invocation from % failed (SQLSTATE %): %', p_source, SQLSTATE, SQLERRM;
    RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_process_auto_apply_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_should_trigger boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_trigger := NEW.provider_status = 'waiting';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Trigger when a job enters the waiting queue, and when a terminal run
    -- frees platform capacity for the remaining waiting jobs.
    v_should_trigger :=
      (OLD.provider_status IS DISTINCT FROM NEW.provider_status
        AND NEW.provider_status = 'waiting')
      OR
      (OLD.provider_status IS DISTINCT FROM NEW.provider_status
        AND OLD.provider_status NOT IN (
          'completed', 'succeeded', 'failed', 'terminated', 'cancelled', 'canceled', 'waiting'
        )
        AND NEW.provider_status IN (
          'completed', 'succeeded', 'failed', 'terminated', 'cancelled', 'canceled'
        ));
  END IF;

  IF v_should_trigger THEN
    PERFORM public.invoke_process_auto_apply_queue('trigger', NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_auto_apply_queue_process ON public.applications;
CREATE TRIGGER trigger_auto_apply_queue_process
  AFTER INSERT OR UPDATE OF provider_status ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_process_auto_apply_queue();

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
      FROM public.applications AS a
      WHERE a.canonical_stage = 'queued'
        AND a.provider_status = 'waiting'
    );
  $cron$
);

-- Existing security-definer queue functions need an explicit, restrictive
-- lookup path. pgcrypto was installed in public by the Phase 5 migration.
ALTER FUNCTION public.acquire_next_auto_apply_jobs(integer)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.upsert_job_from_discovery(
  uuid, text, text, text, text, text, text, text, integer, integer, text,
  text, text[], jsonb, integer, text, text[], text, double precision, text,
  boolean
) SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.invoke_process_auto_apply_queue(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_process_auto_apply_queue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_next_auto_apply_jobs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_job_from_discovery(
  uuid, text, text, text, text, text, text, text, integer, integer, text,
  text, text[], jsonb, integer, text, text[], text, double precision, text,
  boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.invoke_process_auto_apply_queue(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_next_auto_apply_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_job_from_discovery(
  uuid, text, text, text, text, text, text, text, integer, integer, text,
  text, text[], jsonb, integer, text, text[], text, double precision, text,
  boolean
) TO authenticated, service_role;
