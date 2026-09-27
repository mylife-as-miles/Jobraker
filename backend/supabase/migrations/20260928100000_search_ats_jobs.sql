-- Search API over the ATS job index (job search re-engineering, Phase 1).
--
-- Called from the app with supabase.rpc('search_ats_jobs', {...}).
-- SECURITY INVOKER: runs with the caller's rights, so the existing RLS policy
-- (signed-in users may read ats_jobs) applies.
--
-- p_query            free text, web-search syntax ("product manager" -senior)
-- p_workable_from    ISO country code; keeps jobs open worldwide or listing it
-- p_remote_scopes    any of worldwide, restricted, onsite, hybrid, unknown
-- p_ats              platforms to include
-- p_company_ids      companies to include
-- p_questions_known  true = only jobs whose application questions are known

CREATE OR REPLACE FUNCTION public.search_ats_jobs(
  p_query text DEFAULT NULL,
  p_workable_from text DEFAULT NULL,
  p_remote_scopes text[] DEFAULT NULL,
  p_ats text[] DEFAULT NULL,
  p_company_ids uuid[] DEFAULT NULL,
  p_questions_known boolean DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  ats text,
  title text,
  company_name text,
  location_text text,
  remote_scope text,
  countries text[],
  department text,
  employment_type text,
  apply_url text,
  job_url text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text,
  questions_known boolean,
  required_question_keys text[],
  posted_at timestamptz,
  rank real,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      CASE WHEN nullif(btrim(p_query), '') IS NULL THEN NULL
           ELSE websearch_to_tsquery('english', p_query) END AS tsq,
      upper(nullif(btrim(p_workable_from), '')) AS country
  ),
  matches AS (
    SELECT j.*, CASE WHEN params.tsq IS NULL THEN 0 ELSE ts_rank(j.search_vector, params.tsq) END AS rank
    FROM public.ats_jobs AS j, params
    WHERE j.status = 'open'
      AND (params.tsq IS NULL OR j.search_vector @@ params.tsq)
      AND (params.country IS NULL OR j.remote_scope = 'worldwide' OR params.country = ANY (j.countries))
      AND (p_remote_scopes IS NULL OR j.remote_scope = ANY (p_remote_scopes))
      AND (p_ats IS NULL OR j.ats = ANY (p_ats))
      AND (p_company_ids IS NULL OR j.company_id = ANY (p_company_ids))
      AND (p_questions_known IS NULL OR j.questions_known = p_questions_known)
  )
  SELECT
    m.id, m.company_id, m.ats, m.title, m.company_name, m.location_text, m.remote_scope, m.countries,
    m.department, m.employment_type, m.apply_url, m.job_url,
    m.salary_min, m.salary_max, m.salary_currency, m.salary_period,
    m.questions_known,
    -- Canonical keys of required questions, for readiness checks against the profile.
    CASE WHEN m.questions_known THEN ARRAY(
      SELECT DISTINCT q ->> 'key'
      FROM jsonb_array_elements(COALESCE(m.questions, '[]'::jsonb)) AS q
      WHERE (q ->> 'required')::boolean AND q ->> 'key' IS NOT NULL
    ) ELSE NULL END AS required_question_keys,
    m.posted_at,
    m.rank::real,
    count(*) OVER () AS total_count
  FROM matches AS m
  ORDER BY m.rank DESC, m.posted_at DESC NULLS LAST, m.id
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.search_ats_jobs(text, text, text[], text[], uuid[], boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_ats_jobs(text, text, text[], text[], uuid[], boolean, integer, integer) TO authenticated, service_role;
