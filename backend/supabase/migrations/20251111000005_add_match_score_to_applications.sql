-- Add match_score column to applications table
-- This column stores the AI-calculated match score (0-100) for each application

BEGIN;

-- Add match_score column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'match_score'
  ) THEN
    ALTER TABLE public.applications
      ADD COLUMN match_score INTEGER;
    
    -- Add check constraint to ensure match_score is between 0 and 100
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_match_score_check
      CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100));
    
    -- Add comment
    COMMENT ON COLUMN public.applications.match_score IS 'AI-calculated match score (0-100) indicating how well the job matches the user profile';
  END IF;
END $$;

-- Migrate existing match scores from notes field to match_score column
-- This extracts match scores stored as "match:XX" or "match=XX" in the notes field
DO $$
DECLARE
  rec RECORD;
  extracted_score INTEGER;
BEGIN
  FOR rec IN 
    SELECT id, notes 
    FROM public.applications 
    WHERE notes IS NOT NULL 
    AND match_score IS NULL
    AND (notes ~* 'match[:=]\s*(\d{1,3})')
  LOOP
    -- Extract the match score from notes using regex
    extracted_score := NULL;
    BEGIN
      extracted_score := (
        SELECT (regexp_match(rec.notes, 'match[:=]\s*(\d{1,3})', 'i'))[1]::INTEGER
      );
      -- Clamp to 0-100 range
      IF extracted_score IS NOT NULL THEN
        extracted_score := GREATEST(0, LEAST(100, extracted_score));
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        extracted_score := NULL;
    END;
    
    -- Update the match_score column if we extracted a valid score
    IF extracted_score IS NOT NULL THEN
      UPDATE public.applications
      SET match_score = extracted_score
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

COMMIT;

