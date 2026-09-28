-- Schedule the ATS job index sync (job search re-engineering, Phase 1).
--
-- Every 5 minutes, ats-sync refreshes the 5 companies synced longest ago, so
-- all boards are revisited every couple of hours. Unchanged jobs cost no
-- writes, so repeat runs are cheap.
--
-- Requires Vault secrets (same pattern as invoke_process_auto_apply_queue):
--   project_url      https://<ref>.supabase.co   (already used by the auto-apply cron)
--   ats_sync_secret  same value as the ATS_SYNC_SECRET edge function secret

CREATE OR REPLACE FUNCTION public.invoke_ats_sync(p_limit integer DEFAULT 5)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_project_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT NULLIF(btrim(v.decrypted_secret), '') INTO v_project_url
  FROM vault.decrypted_secrets AS v WHERE v.name = 'project_url' LIMIT 1;
  SELECT NULLIF(btrim(v.decrypted_secret), '') INTO v_secret
  FROM vault.decrypted_secrets AS v WHERE v.name = 'ats_sync_secret' LIMIT 1;

  IF v_project_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'ATS sync skipped: Vault secret project_url or ats_sync_secret is missing';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/ats-sync',
    body := jsonb_build_object('limit', GREATEST(1, LEAST(COALESCE(p_limit, 5), 20))),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    timeout_milliseconds := 150000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Only the scheduler (postgres) and the service role may trigger a sync.
REVOKE ALL ON FUNCTION public.invoke_ats_sync(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_ats_sync(integer) TO service_role;

DO $unschedule$
BEGIN
  PERFORM cron.unschedule('ats-sync-cron');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$unschedule$;

SELECT cron.schedule('ats-sync-cron', '*/5 * * * *', $cron$ SELECT public.invoke_ats_sync(5); $cron$);
