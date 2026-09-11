-- 20260911090000_isolate_edge_auto_apply_queue.sql
-- Production hardening for Auto Apply / ApplicationPackage architecture:
-- 1. Redefine claim_next_rtrvr_auto_apply_jobs to strictly exclude Edge-owned / ApplicationPackage jobs.
-- 2. Redefine acquire_next_auto_apply_jobs to strictly require Edge-owned / ApplicationPackage jobs (symmetric isolation).
-- 3. Update resume_waiting_rtrvr_auto_apply_job to set provider_status = 'waiting' for Edge jobs.

-- 1. EXCLUDE EDGE JOBS FROM LEGACY NODE WORKER CLAIM
CREATE OR REPLACE FUNCTION public.claim_next_rtrvr_auto_apply_jobs(
  p_limit integer default 3,
  p_worker_id text default null,
  p_lease_seconds integer default 900
)
RETURNS TABLE (application_id uuid, attempt_number integer, lease_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id text := coalesce(nullif(trim(p_worker_id), ''), 'automation-worker');
  v_lease interval := make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 900), 3600)));
BEGIN
  p_limit := greatest(1, least(coalesce(p_limit, 3), 25));

  RETURN QUERY
  WITH candidates AS (
    SELECT a.id
    FROM public.applications a
    WHERE a.canonical_stage = 'queued'
      AND coalesce(a.automation_provider, 'rtrvr') = 'rtrvr'
      -- Strictly exclude modern Edge-owned ApplicationPackage rows
      AND (a.provider_run_output->>'execution_owner' IS NULL OR a.provider_run_output->>'execution_owner' <> 'edge')
      AND (a.provider_run_output->'application_package' IS NULL)
      AND (
        coalesce(a.provider_status, '') IN ('waiting_worker', 'retrying')
        OR (
          coalesce(a.provider_status, '') = 'rtrvr_running'
          AND coalesce(a.automation_lease_expires_at, '-infinity'::timestamptz) < now()
        )
      )
      AND (
        a.provider_run_output->'queue_parameters'->>'provider' = 'rtrvr'
        OR a.automation_provider = 'rtrvr'
      )
    ORDER BY a.created_at ASC, a.id ASC
    LIMIT p_limit
    FOR UPDATE OF a SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.applications a
    SET provider_status = 'rtrvr_running',
        automation_claimed_by = v_worker_id,
        automation_lease_token = gen_random_uuid(),
        automation_lease_expires_at = now() + v_lease,
        automation_heartbeat_at = now(),
        automation_attempt_number = greatest(coalesce(a.automation_attempt_number, 0), 0) + 1,
        updated_at = now()
    FROM candidates c
    WHERE a.id = c.id
    RETURNING a.id, a.automation_attempt_number, a.automation_lease_token
  )
  SELECT claimed.id, claimed.automation_attempt_number, claimed.automation_lease_token
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_rtrvr_auto_apply_jobs(integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_next_rtrvr_auto_apply_jobs(integer, text, integer) TO service_role;

-- 2. SYMMETRIC ISOLATION: ACQUIRE NEXT AUTO APPLY JOBS (EDGE ONLY)
-- Strictly claims applications satisfying:
--   provider_run_output.execution_owner = "edge" OR provider_run_output.application_package IS NOT NULL
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
        -- Strictly require Edge ownership for Edge queue claims
        AND (provider_run_output->>'execution_owner' = 'edge' OR provider_run_output->'application_package' IS NOT NULL)
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
      -- Strictly require Edge ownership for Edge queue claims
      AND (a.provider_run_output->>'execution_owner' = 'edge' OR a.provider_run_output->'application_package' IS NOT NULL)
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
      -- Strictly require Edge ownership for Edge queue claims
      AND (a.provider_run_output->>'execution_owner' = 'edge' OR a.provider_run_output->'application_package' IS NOT NULL)
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

-- 3. UPDATE RESUME FUNCTION FOR EDGE VS LEGACY
CREATE OR REPLACE FUNCTION public.resume_waiting_rtrvr_auto_apply_job(
  p_application_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean := false;
  v_is_edge boolean := false;
BEGIN
  SELECT (a.provider_run_output->>'execution_owner' = 'edge' OR a.provider_run_output->'application_package' IS NOT NULL)
  INTO v_is_edge
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_is_edge THEN
    UPDATE public.applications
    SET provider_status = 'waiting',
        canonical_stage = 'queued',
        failure_reason = null,
        automation_claimed_by = null,
        automation_lease_token = null,
        automation_lease_expires_at = null,
        automation_heartbeat_at = null,
        updated_at = now()
    WHERE id = p_application_id
      AND user_id = (SELECT auth.uid())
      AND canonical_stage = 'queued'
      AND automation_provider = 'rtrvr'
      AND provider_status = 'waiting_for_user'
      AND automation_idempotency_key IS NOT NULL
      AND (automation_lease_expires_at IS NULL OR automation_lease_expires_at < now())
      AND coalesce(provider_run_output #>> '{latest_provider_result,result,submitted}', 'false') <> 'true'
    RETURNING true INTO v_updated;
  ELSE
    UPDATE public.applications
    SET provider_status = 'waiting_worker',
        failure_reason = null,
        automation_claimed_by = null,
        automation_lease_token = null,
        automation_lease_expires_at = null,
        automation_heartbeat_at = null,
        updated_at = now()
    WHERE id = p_application_id
      AND user_id = (SELECT auth.uid())
      AND canonical_stage = 'queued'
      AND automation_provider = 'rtrvr'
      AND provider_status = 'waiting_for_user'
      AND automation_idempotency_key IS NOT NULL
      AND (automation_lease_expires_at IS NULL OR automation_lease_expires_at < now())
      AND coalesce(provider_run_output #>> '{latest_provider_result,result,submitted}', 'false') <> 'true'
    RETURNING true INTO v_updated;
  END IF;

  RETURN coalesce(v_updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.resume_waiting_rtrvr_auto_apply_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_waiting_rtrvr_auto_apply_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_waiting_rtrvr_auto_apply_job(uuid) TO service_role;
