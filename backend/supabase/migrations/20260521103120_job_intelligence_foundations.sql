-- Job intelligence foundations inspired by the JustHireMe audit.
-- Adds durable storage for quality gates, job feedback, ATS coverage,
-- generated application packages, and scout-mode summaries.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS lead_quality_score integer,
  ADD COLUMN IF NOT EXISTS lead_quality_reason text,
  ADD COLUMN IF NOT EXISTS lead_quality_tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_lead_quality_score_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_lead_quality_score_check
  CHECK (lead_quality_score IS NULL OR (lead_quality_score >= 0 AND lead_quality_score <= 100));

COMMENT ON COLUMN public.jobs.lead_quality_score IS
  '0-100 deterministic quality score applied before a discovered job is saved.';
COMMENT ON COLUMN public.jobs.lead_quality_reason IS
  'Short explanation for the quality score.';
COMMENT ON COLUMN public.jobs.lead_quality_tags IS
  'Machine-readable quality tags such as fresh, missing_company, spam_signal, or seniority_mismatch.';

CREATE INDEX IF NOT EXISTS jobs_user_lead_quality_idx
  ON public.jobs (user_id, lead_quality_score DESC, created_at DESC);

ALTER TABLE public.job_evaluations
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ats_keyword_coverage jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.job_evaluations.score_breakdown IS
  'Normalized explainable score breakdown: role alignment, skills, seniority, location, compensation, evidence, and red flags.';
COMMENT ON COLUMN public.job_evaluations.ats_keyword_coverage IS
  'ATS keyword coverage: JD terms, covered, missing, incorporated, and coverage percent.';

CREATE TABLE IF NOT EXISTS public.job_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  label text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT job_feedback_label_check CHECK (
    label IN (
      'relevant',
      'not_relevant',
      'low_quality',
      'duplicate',
      'already_applied',
      'good_fit'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS job_feedback_user_job_label_idx
  ON public.job_feedback (user_id, job_id, label);

CREATE INDEX IF NOT EXISTS job_feedback_user_created_idx
  ON public.job_feedback (user_id, created_at DESC);

ALTER TABLE public.job_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own job feedback, admins can view all" ON public.job_feedback;
CREATE POLICY "Users can view own job feedback, admins can view all"
  ON public.job_feedback FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own job feedback" ON public.job_feedback;
CREATE POLICY "Users can insert own job feedback"
  ON public.job_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own job feedback" ON public.job_feedback;
CREATE POLICY "Users can update own job feedback"
  ON public.job_feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own job feedback" ON public.job_feedback;
CREATE POLICY "Users can delete own job feedback"
  ON public.job_feedback FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_feedback TO authenticated;
GRANT ALL ON TABLE public.job_feedback TO service_role;

CREATE TABLE IF NOT EXISTS public.application_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  tailored_resume text,
  cover_letter text,
  outreach_email text,
  linkedin_note text,
  fit_bullets text[] NOT NULL DEFAULT '{}'::text[],
  version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT application_packages_status_check CHECK (
    status IN ('draft', 'ready', 'sent', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS application_packages_user_job_idx
  ON public.application_packages (user_id, job_id, updated_at DESC);

ALTER TABLE public.application_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own application packages, admins can view all" ON public.application_packages;
CREATE POLICY "Users can view own application packages, admins can view all"
  ON public.application_packages FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own application packages" ON public.application_packages;
CREATE POLICY "Users can insert own application packages"
  ON public.application_packages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own application packages" ON public.application_packages;
CREATE POLICY "Users can update own application packages"
  ON public.application_packages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own application packages" ON public.application_packages;
CREATE POLICY "Users can delete own application packages"
  ON public.application_packages FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.application_packages TO authenticated;
GRANT ALL ON TABLE public.application_packages TO service_role;

CREATE TABLE IF NOT EXISTS public.scout_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed',
  trigger text NOT NULL DEFAULT 'manual',
  search_query text,
  location text,
  found_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  strong_fit_count integer NOT NULL DEFAULT 0,
  ready_to_tailor_count integer NOT NULL DEFAULT 0,
  summary text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT scout_runs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  CONSTRAINT scout_runs_trigger_check CHECK (trigger IN ('manual', 'scheduled', 'admin'))
);

CREATE INDEX IF NOT EXISTS scout_runs_user_created_idx
  ON public.scout_runs (user_id, created_at DESC);

ALTER TABLE public.scout_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scout runs, admins can view all" ON public.scout_runs;
CREATE POLICY "Users can view own scout runs, admins can view all"
  ON public.scout_runs FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own scout runs" ON public.scout_runs;
CREATE POLICY "Users can insert own scout runs"
  ON public.scout_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own scout runs, admins can update all" ON public.scout_runs;
CREATE POLICY "Users can update own scout runs, admins can update all"
  ON public.scout_runs FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

GRANT SELECT, INSERT, UPDATE ON TABLE public.scout_runs TO authenticated;
GRANT ALL ON TABLE public.scout_runs TO service_role;
