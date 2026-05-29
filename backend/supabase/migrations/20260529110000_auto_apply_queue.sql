-- 20260529110000_auto_apply_queue.sql
-- Implement prioritized, fair-share queue system for Auto Apply runs

-- 1. Create or replace the candidate acquisition RPC function
CREATE OR REPLACE FUNCTION public.acquire_next_auto_apply_jobs(p_platform_max_concurrency integer)
RETURNS TABLE (application_id uuid) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count integer;
  v_available_slots integer;
BEGIN
  p_platform_max_concurrency := GREATEST(1, LEAST(COALESCE(p_platform_max_concurrency, 10), 100));

  -- Count currently active jobs across the entire platform (excluding waiting and old stuck jobs)
  SELECT COUNT(*)::integer INTO v_active_count
  FROM public.applications
  WHERE canonical_stage = 'queued'
    AND COALESCE(provider_status, '') <> 'waiting'
    AND updated_at > now() - interval '3 hours';

  v_available_slots := p_platform_max_concurrency - v_active_count;

  IF v_available_slots <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH user_limits AS (
    SELECT 
      p.id as user_id,
      p.subscription_tier,
      CASE COALESCE(p.subscription_tier, 'Free')
        WHEN 'Ultimate' THEN 8
        WHEN 'Pro' THEN 4
        WHEN 'Basics' THEN 2
        ELSE 1
      END as base_limit,
      COALESCE((
        SELECT SUM(included_quantity)::integer
        FROM public.user_feature_quotas
        WHERE feature_key = 'auto_apply_concurrency'
          AND source = 'addon'
          AND period_start <= now()
          AND period_end > now()
          AND user_id = p.id
      ), 0) as addon_limit,
      (
        SELECT COUNT(*)::integer
        FROM public.applications
        WHERE user_id = p.id
          AND canonical_stage = 'queued'
          AND COALESCE(provider_status, '') <> 'waiting'
          AND updated_at > now() - interval '3 hours'
      ) as active_count
    FROM public.profiles p
    WHERE p.id IN (
      SELECT DISTINCT user_id 
      FROM public.applications 
      WHERE canonical_stage = 'queued' AND provider_status = 'waiting'
    )
  ),
  waiting_jobs AS (
    SELECT 
      a.id,
      a.user_id,
      a.created_at,
      ul.subscription_tier,
      ul.active_count,
      (ul.base_limit + ul.addon_limit) as total_limit,
      ROW_NUMBER() OVER (PARTITION BY a.user_id ORDER BY a.created_at ASC, a.id ASC) as user_job_index,
      MIN(a.created_at) OVER (PARTITION BY a.user_id) as user_oldest_waiting_at,
      CASE COALESCE(ul.subscription_tier, 'Free')
        WHEN 'Ultimate' THEN 1
        WHEN 'Pro' THEN 2
        WHEN 'Basics' THEN 3
        ELSE 4
      END as tier_priority
    FROM public.applications a
    JOIN user_limits ul ON a.user_id = ul.user_id
    WHERE a.canonical_stage = 'queued'
      AND a.provider_status = 'waiting'
  ),
  allowed_jobs AS (
    SELECT *
    FROM waiting_jobs
    WHERE user_job_index <= (total_limit - active_count)
  ),
  locked_jobs AS (
    SELECT a.id, aj.tier_priority, aj.user_job_index, aj.user_oldest_waiting_at, aj.created_at
    FROM public.applications a
    JOIN allowed_jobs aj ON aj.id = a.id
    WHERE a.canonical_stage = 'queued'
      AND a.provider_status = 'waiting'
    ORDER BY 
      aj.tier_priority ASC,
      aj.user_job_index ASC,
      aj.user_oldest_waiting_at ASC,
      aj.created_at ASC,
      a.id ASC
    LIMIT v_available_slots
    FOR UPDATE OF a SKIP LOCKED
  ),
  claimed_jobs AS (
    UPDATE public.applications a
    SET
      provider_status = 'launching',
      updated_at = now()
    FROM locked_jobs lj
    WHERE a.id = lj.id
    RETURNING a.id
  )
  SELECT locked_jobs.id
  FROM locked_jobs
  JOIN claimed_jobs ON claimed_jobs.id = locked_jobs.id
  ORDER BY
    locked_jobs.tier_priority ASC,
    locked_jobs.user_job_index ASC,
    locked_jobs.user_oldest_waiting_at ASC,
    locked_jobs.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_next_auto_apply_jobs(integer) TO service_role;

-- 2. Create or replace trigger function to trigger the queue processor asynchronously
CREATE OR REPLACE FUNCTION public.trigger_process_auto_apply_queue()
RETURNS trigger AS $$
DECLARE
  project_url text;
  service_role_key text;
  req_id bigint;
  auth_header text;
  should_trigger boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.provider_status = 'waiting' THEN
      should_trigger := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Trigger if a run is queued, or if an active run completed/failed/terminated (freeing a slot).
    IF (COALESCE(OLD.provider_status, '') IS DISTINCT FROM COALESCE(NEW.provider_status, '') AND NEW.provider_status = 'waiting') OR
       (COALESCE(OLD.provider_status, '') IS DISTINCT FROM COALESCE(NEW.provider_status, '')
        AND OLD.provider_status NOT IN ('completed', 'succeeded', 'failed', 'terminated', 'cancelled', 'canceled', 'waiting')
        AND NEW.provider_status IN ('completed', 'succeeded', 'failed', 'terminated', 'cancelled', 'canceled')) THEN
      should_trigger := true;
    END IF;
  END IF;

  IF should_trigger THEN
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
      auth_header := 'Bearer SYSTEM_TRIGGER';
    ELSE
      auth_header := 'Bearer ' || service_role_key;
    END IF;

    -- Call the edge function process-auto-apply-queue asynchronously using pg_net
    SELECT net.http_post(
      url := project_url || '/functions/v1/process-auto-apply-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', auth_header
      ),
      body := '{}'::jsonb
    ) INTO req_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind trigger to applications
DROP TRIGGER IF EXISTS trigger_auto_apply_queue_process ON public.applications;
CREATE TRIGGER trigger_auto_apply_queue_process
  AFTER INSERT OR UPDATE OF provider_status ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_process_auto_apply_queue();

-- 4. Setup cron job to trigger queue worker if any waiting jobs are missed
DO $$
BEGIN
  PERFORM cron.unschedule('process-auto-apply-queue-cron');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;$$;

SELECT cron.schedule(
  'process-auto-apply-queue-cron',
  '* * * * *', -- every minute
  $$
  SELECT net.http_post(
    url := COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url'), 'http://kong:8000') || '/functions/v1/process-auto-apply-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'), 'SYSTEM_TRIGGER')
    ),
    body := '{}'::jsonb
  )
  WHERE EXISTS (
    SELECT 1 FROM public.applications 
    WHERE canonical_stage = 'queued' AND provider_status = 'waiting'
  );
  $$
);
