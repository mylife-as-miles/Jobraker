-- Return only fresh, user-visible jobs for a specific search run.
-- Duplicate rows remain in job_search_results for billing and diagnostics.

CREATE OR REPLACE FUNCTION public.get_job_search_results_for_run(
  p_agent_run_id UUID
)
RETURNS TABLE (
  result_id UUID,
  job_id UUID,
  rank INTEGER,
  displayable BOOLEAN,
  is_new_to_user BOOLEAN,
  title TEXT,
  company TEXT,
  location TEXT,
  apply_url TEXT,
  description TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  posted_at TIMESTAMPTZ,
  source_kind TEXT,
  lead_quality_score NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.job_search_runs AS run
    WHERE run.agent_run_id = p_agent_run_id
      AND (
        run.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.user_roles AS user_role
          WHERE user_role.user_id = auth.uid()
            AND user_role.role IN ('admin', 'super_admin')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    result.id,
    result.job_id,
    result.rank,
    result.displayable,
    result.is_new_to_user,
    job.title,
    job.company,
    job.location,
    job.apply_url,
    job.description,
    job.salary_min,
    job.salary_max,
    job.salary_currency,
    job.posted_at,
    job.source_kind::TEXT,
    job.lead_quality_score,
    result.created_at
  FROM public.job_search_results AS result
  JOIN public.jobs AS job ON job.id = result.job_id
  WHERE result.agent_run_id = p_agent_run_id
    AND result.displayable = true
    AND result.is_new_to_user = true
  ORDER BY result.rank NULLS LAST, result.created_at ASC;
END;
$function$;

COMMENT ON FUNCTION public.get_job_search_results_for_run(UUID) IS
  'Returns fresh displayable jobs for one search run. Duplicate results remain stored for audit and billing but are not shown as refreshed opportunities.';

REVOKE ALL ON FUNCTION public.get_job_search_results_for_run(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_search_results_for_run(UUID) TO authenticated, service_role;
