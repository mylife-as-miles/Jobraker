-- Canonical application/job states, persistent job evaluations, and candidate memory.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS proof_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_narratives text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS red_flags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS target_archetypes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS story_bank jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tracked_companies jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.proof_points IS 'Structured proof points and quantified wins used during tailoring.';
COMMENT ON COLUMN public.profiles.preferred_narratives IS 'Preferred positioning themes such as founder-facing, platform, or customer-facing.';
COMMENT ON COLUMN public.profiles.red_flags IS 'Explicit dealbreakers that should block or downgrade job recommendations.';
COMMENT ON COLUMN public.profiles.target_archetypes IS 'Preferred role archetypes used by the job evaluation layer.';
COMMENT ON COLUMN public.profiles.story_bank IS 'Reusable interview stories and examples that can be mapped to openings.';
COMMENT ON COLUMN public.profiles.tracked_companies IS 'Tracked companies or careers URLs used by the hybrid discovery pipeline.';

CREATE TABLE IF NOT EXISTS public.job_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  archetype text,
  canonical_decision text NOT NULL DEFAULT 'draft_first',
  confidence_score integer NOT NULL DEFAULT 50,
  exact_fit_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  compensation jsonb NOT NULL DEFAULT '{}'::jsonb,
  personalization_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  interview_stories jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_keywords text[] NOT NULL DEFAULT '{}'::text[],
  missing_requirements text[] NOT NULL DEFAULT '{}'::text[],
  tailoring_suggestions text[] NOT NULL DEFAULT '{}'::text[],
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_evaluations_user_job_idx
  ON public.job_evaluations (user_id, job_id);

CREATE INDEX IF NOT EXISTS job_evaluations_user_created_idx
  ON public.job_evaluations (user_id, created_at DESC);

ALTER TABLE public.job_evaluations
  DROP CONSTRAINT IF EXISTS job_evaluations_canonical_decision_check;

ALTER TABLE public.job_evaluations
  ADD CONSTRAINT job_evaluations_canonical_decision_check
  CHECK (canonical_decision IN ('strong_yes', 'draft_first', 'risky', 'no_go'));

ALTER TABLE public.job_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own job evaluations" ON public.job_evaluations;
CREATE POLICY "Users can view their own job evaluations"
  ON public.job_evaluations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own job evaluations" ON public.job_evaluations;
CREATE POLICY "Users can insert their own job evaluations"
  ON public.job_evaluations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own job evaluations" ON public.job_evaluations;
CREATE POLICY "Users can update their own job evaluations"
  ON public.job_evaluations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS canonical_status text NOT NULL DEFAULT 'discovered',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_confidence numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_tracked_company boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS evaluation_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_canonical_status_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_canonical_status_check
  CHECK (
    canonical_status IN (
      'discovered',
      'evaluated',
      'draft_ready',
      'queued',
      'submitted',
      'failed',
      'interview',
      'offer',
      'rejected',
      'withdrawn',
      'hidden'
    )
  );

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_verification_status_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_verification_status_check
  CHECK (verification_status IN ('unverified', 'verified', 'stale', 'failed'));

CREATE INDEX IF NOT EXISTS jobs_user_queue_idx
  ON public.jobs (user_id, hidden, canonical_status, created_at DESC);

CREATE INDEX IF NOT EXISTS jobs_user_source_kind_idx
  ON public.jobs (user_id, source_kind, last_verified_at DESC);

UPDATE public.jobs
SET discovered_at = COALESCE(discovered_at, created_at, now()),
    canonical_status = CASE
      WHEN hidden IS TRUE THEN 'hidden'
      WHEN lower(COALESCE(canonical_status, '')) IN (
        'discovered',
        'evaluated',
        'draft_ready',
        'queued',
        'submitted',
        'failed',
        'interview',
        'offer',
        'rejected',
        'withdrawn',
        'hidden'
      ) THEN canonical_status
      ELSE 'discovered'
    END,
    verification_status = CASE
      WHEN verification_status IN ('unverified', 'verified', 'stale', 'failed') THEN verification_status
      ELSE 'unverified'
    END;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS canonical_stage text NOT NULL DEFAULT 'submitted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applications_job_id_fkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.applications
SET status = CASE
    WHEN lower(COALESCE(status, '')) IN ('saved', 'draft') THEN 'Draft'
    WHEN lower(COALESCE(status, '')) = 'submitted' THEN 'Pending'
    WHEN lower(COALESCE(status, '')) = 'applied' THEN 'Applied'
    WHEN lower(COALESCE(status, '')) = 'failed' THEN 'Failed'
    WHEN lower(COALESCE(status, '')) = 'interview' THEN 'Interview'
    WHEN lower(COALESCE(status, '')) = 'offer' THEN 'Offer'
    WHEN lower(COALESCE(status, '')) = 'rejected' THEN 'Rejected'
    WHEN lower(COALESCE(status, '')) = 'withdrawn' THEN 'Withdrawn'
    WHEN status IS NULL OR btrim(status) = '' THEN 'Pending'
    ELSE status
  END;

UPDATE public.applications
SET canonical_stage = CASE
    WHEN draft_status = 'draft' OR status = 'Draft' THEN 'draft_ready'
    WHEN status = 'Pending' OR lower(COALESCE(provider_status, '')) = 'pending' THEN 'queued'
    WHEN status = 'Applied' THEN 'submitted'
    WHEN status = 'Failed' OR lower(COALESCE(provider_status, '')) IN ('failed', 'terminated', 'error') THEN 'failed'
    WHEN status = 'Interview' THEN 'interview'
    WHEN status = 'Offer' THEN 'offer'
    WHEN status = 'Rejected' THEN 'rejected'
    WHEN status = 'Withdrawn' THEN 'withdrawn'
    ELSE COALESCE(canonical_stage, 'submitted')
  END;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (
    status IN (
      'Draft',
      'Pending',
      'Applied',
      'Failed',
      'Interview',
      'Offer',
      'Rejected',
      'Withdrawn'
    )
  );

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_canonical_stage_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_canonical_stage_check
  CHECK (
    canonical_stage IN (
      'draft_ready',
      'queued',
      'submitted',
      'failed',
      'interview',
      'offer',
      'rejected',
      'withdrawn'
    )
  );

CREATE INDEX IF NOT EXISTS applications_user_canonical_stage_idx
  ON public.applications (user_id, canonical_stage, updated_at DESC);
