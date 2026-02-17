-- Create resume_analyses table to store AI-powered resume analysis results
-- This table stores analysis results per resume, allowing users to track improvements over time

BEGIN;

-- Create resume_analyses table
CREATE TABLE IF NOT EXISTS public.resume_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Scores (0-100)
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  alignment_score integer NOT NULL CHECK (alignment_score >= 0 AND alignment_score <= 100),
  ats_score integer NOT NULL CHECK (ats_score >= 0 AND ats_score <= 100),
  readability_score integer NOT NULL CHECK (readability_score >= 0 AND readability_score <= 100),
  job_fit_likelihood integer NOT NULL CHECK (job_fit_likelihood >= 0 AND job_fit_likelihood <= 100),
  
  -- Grade and summary
  grade text NOT NULL,
  summary text NOT NULL,
  
  -- Arrays stored as JSONB
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Optional fields
  ats_risk_narrative text,
  metadata jsonb,
  
  -- Timestamps
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS resume_analyses_resume_id_idx ON public.resume_analyses(resume_id);
CREATE INDEX IF NOT EXISTS resume_analyses_user_id_idx ON public.resume_analyses(user_id);
CREATE INDEX IF NOT EXISTS resume_analyses_analyzed_at_idx ON public.resume_analyses(analyzed_at DESC);

-- Note: Multiple analyses per resume are allowed to track improvements over time
-- Query for the latest analysis using: ORDER BY analyzed_at DESC LIMIT 1

-- Enable RLS
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  -- Select own analyses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'resume_analyses' 
    AND policyname = 'Select own resume analyses'
  ) THEN
    CREATE POLICY "Select own resume analyses"
      ON public.resume_analyses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Insert own analyses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'resume_analyses' 
    AND policyname = 'Insert own resume analyses'
  ) THEN
    CREATE POLICY "Insert own resume analyses"
      ON public.resume_analyses FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Update own analyses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'resume_analyses' 
    AND policyname = 'Update own resume analyses'
  ) THEN
    CREATE POLICY "Update own resume analyses"
      ON public.resume_analyses FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Delete own analyses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'resume_analyses' 
    AND policyname = 'Delete own resume analyses'
  ) THEN
    CREATE POLICY "Delete own resume analyses"
      ON public.resume_analyses FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.resume_analyses IS 'Stores AI-powered resume analysis results per resume';
COMMENT ON COLUMN public.resume_analyses.overall_score IS 'Overall resume quality score (0-100)';
COMMENT ON COLUMN public.resume_analyses.alignment_score IS 'Alignment with user profile score (0-100)';
COMMENT ON COLUMN public.resume_analyses.ats_score IS 'ATS (Applicant Tracking System) readiness score (0-100)';
COMMENT ON COLUMN public.resume_analyses.readability_score IS 'Human readability score (0-100)';
COMMENT ON COLUMN public.resume_analyses.job_fit_likelihood IS 'Job fit/interview likelihood percentage (0-100)';
COMMENT ON COLUMN public.resume_analyses.grade IS 'Letter grade (e.g., A, B, C)';
COMMENT ON COLUMN public.resume_analyses.summary IS 'Overall analysis summary text';
COMMENT ON COLUMN public.resume_analyses.strengths IS 'Array of key strengths (stored as JSONB)';
COMMENT ON COLUMN public.resume_analyses.gaps IS 'Array of critical gaps/weaknesses (stored as JSONB)';
COMMENT ON COLUMN public.resume_analyses.recommendations IS 'Array of recommendation objects with focus, action, and impact (stored as JSONB)';

COMMIT;

