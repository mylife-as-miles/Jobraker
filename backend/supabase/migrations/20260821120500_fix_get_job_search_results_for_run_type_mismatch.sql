-- ── Migration: 20260821120500_fix_get_job_search_results_for_run_type_mismatch.sql ────
-- Fixes "structure of query does not match function result type" by applying
-- explicit casts to every column in the RETURN QUERY SELECT statement.

DROP FUNCTION IF EXISTS public.get_job_search_results_for_run(UUID);

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
    result.id::UUID,
    result.job_id::UUID,
    result.rank::INTEGER,
    result.displayable::BOOLEAN,
    result.is_new_to_user::BOOLEAN,
    job.title::TEXT,
    job.company::TEXT,
    job.location::TEXT,
    job.apply_url::TEXT,
    job.description::TEXT,
    job.salary_min::INTEGER,
    job.salary_max::INTEGER,
    job.salary_currency::TEXT,
    job.posted_at::TIMESTAMPTZ,
    job.source_kind::TEXT,
    job.lead_quality_score::NUMERIC,
    result.created_at::TIMESTAMPTZ
  FROM public.job_search_results AS result
  JOIN public.jobs AS job ON job.id = result.job_id
  WHERE result.agent_run_id = p_agent_run_id
    AND result.displayable = true
    AND result.is_new_to_user = true
  ORDER BY result.rank NULLS LAST, result.created_at ASC;
END;
$function$;

COMMENT ON FUNCTION public.get_job_search_results_for_run(UUID) IS
  'Returns fresh displayable jobs for one search run with explicit column type casts.';

REVOKE ALL ON FUNCTION public.get_job_search_results_for_run(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_search_results_for_run(UUID) TO authenticated, service_role;
