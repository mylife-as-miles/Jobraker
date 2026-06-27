-- ── RPC: get_job_search_results_for_run (Bypass & Fix) ──────────────────────
-- Corrects the access check to allow service_role bypass, and ensures execution permissions are granted.

CREATE OR REPLACE FUNCTION public.get_job_search_results_for_run(
  p_agent_run_id UUID
)
RETURNS TABLE (
  result_id        UUID,
  job_id           UUID,
  rank             INTEGER,
  displayable      BOOLEAN,
  is_new_to_user   BOOLEAN,
  title            TEXT,
  company          TEXT,
  location         TEXT,
  apply_url        TEXT,
  description      TEXT,
  salary_min       INTEGER,
  salary_max       INTEGER,
  salary_currency  TEXT,
  posted_at        TIMESTAMPTZ,
  source_kind      TEXT,
  lead_quality_score NUMERIC,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RLS: Only the run owner, admins, or service_role may view results
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.job_search_runs jsr
    WHERE jsr.agent_run_id = p_agent_run_id
      AND (
        jsr.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'super_admin')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    jsr2.id           AS result_id,
    jsr2.job_id,
    jsr2.rank,
    jsr2.displayable,
    jsr2.is_new_to_user,
    j.title,
    j.company,
    j.location,
    j.apply_url,
    j.description,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.posted_at,
    j.source_kind::TEXT,
    j.lead_quality_score,
    jsr2.created_at
  FROM public.job_search_results jsr2
  JOIN public.jobs j ON j.id = jsr2.job_id
  WHERE jsr2.agent_run_id = p_agent_run_id
    AND jsr2.displayable = true
  ORDER BY jsr2.rank NULLS LAST, jsr2.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_job_search_results_for_run(UUID) IS
  'Returns all displayable job results for a completed search run. Caller must own the run, be an admin, or be the service_role.';

GRANT EXECUTE ON FUNCTION public.get_job_search_results_for_run(UUID) TO authenticated, service_role;
