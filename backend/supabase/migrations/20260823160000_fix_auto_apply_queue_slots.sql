-- 20260823160000_fix_auto_apply_queue_slots.sql
-- Fix acquire_next_auto_apply_jobs to properly handle queued, waiting, and launching states
-- and avoid counting stale jobs as active slots.

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

  -- Count currently active jobs actually executing in browser (rtrvr_running within last 10 mins)
  SELECT COUNT(*)::integer INTO v_active_count
  FROM public.applications
  WHERE canonical_stage = 'queued'
    AND provider_status = 'rtrvr_running'
    AND updated_at > now() - interval '10 minutes';

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
          AND provider_status = 'rtrvr_running'
          AND updated_at > now() - interval '10 minutes'
      ) as active_count
    FROM public.profiles p
    WHERE p.id IN (
      SELECT DISTINCT user_id 
      FROM public.applications 
      WHERE canonical_stage = 'queued'
        AND COALESCE(provider_status, 'waiting') IN ('waiting', 'queued', 'waiting_worker', 'launching', 'retrying')
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
      AND COALESCE(a.provider_status, 'waiting') IN ('waiting', 'queued', 'waiting_worker', 'launching', 'retrying')
  ),
  allowed_jobs AS (
    SELECT *
    FROM waiting_jobs
    WHERE user_job_index <= GREATEST(1, total_limit - active_count)
  ),
  locked_jobs AS (
    SELECT a.id, aj.tier_priority, aj.user_job_index, aj.user_oldest_waiting_at, aj.created_at
    FROM public.applications a
    JOIN allowed_jobs aj ON aj.id = a.id
    WHERE a.canonical_stage = 'queued'
      AND COALESCE(a.provider_status, 'waiting') IN ('waiting', 'queued', 'waiting_worker', 'launching', 'retrying')
    ORDER BY 
      aj.tier_priority ASC,
      aj.user_job_index ASC,
      aj.user_oldest_waiting_at ASC,
      aj.created_at ASC
    LIMIT v_available_slots
    FOR UPDATE SKIP LOCKED
  )
  SELECT locked_jobs.id FROM locked_jobs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_next_auto_apply_jobs(integer) TO service_role;
