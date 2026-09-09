-- Migration: Add private share token and views/downloads metrics to resumes
ALTER TABLE public.resumes
ADD COLUMN IF NOT EXISTS public_share_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS share_token TEXT,
ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS downloads INTEGER NOT NULL DEFAULT 0;

-- Backfill share_token for existing resumes that do not have one
UPDATE public.resumes
SET share_token = encode(gen_random_bytes(16), 'hex')
WHERE share_token IS NULL;

-- Default new resumes to have a generated share_token
ALTER TABLE public.resumes
ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- Unique constraint / index on share_token
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resumes_share_token_key'
  ) THEN
    ALTER TABLE public.resumes ADD CONSTRAINT resumes_share_token_key UNIQUE (share_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resumes_share_token_idx ON public.resumes(share_token);
CREATE INDEX IF NOT EXISTS resumes_public_share_idx ON public.resumes(public_share_enabled);

-- Allow public viewing of resumes if either public_share_enabled is true OR via matching share_token
CREATE OR REPLACE FUNCTION public.get_shared_resume(
    p_resume_id UUID,
    p_token TEXT DEFAULT NULL
)
RETURNS SETOF public.resumes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT r.*
    FROM public.resumes r
    WHERE r.id = p_resume_id
      AND (
          r.public_share_enabled = true
          OR (p_token IS NOT NULL AND r.share_token IS NOT NULL AND r.share_token = p_token)
          OR (auth.uid() IS NOT NULL AND r.user_id = auth.uid())
      );
END;
$$;

-- Allow safe stat incrementing for views and downloads
CREATE OR REPLACE FUNCTION public.increment_resume_stat(
    p_resume_id UUID,
    p_stat_type TEXT,
    p_token TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed BOOLEAN;
BEGIN
    -- Verify the resume exists and caller has access (publicly shared, matching token, or owner)
    SELECT EXISTS (
        SELECT 1 FROM public.resumes r
        WHERE r.id = p_resume_id
          AND (
              r.public_share_enabled = true
              OR (p_token IS NOT NULL AND r.share_token IS NOT NULL AND r.share_token = p_token)
              OR (auth.uid() IS NOT NULL AND r.user_id = auth.uid())
          )
    ) INTO v_allowed;

    IF NOT v_allowed THEN
        RETURN;
    END IF;

    IF p_stat_type = 'views' THEN
        UPDATE public.resumes
        SET views = COALESCE(views, 0) + 1
        WHERE id = p_resume_id;
    ELSIF p_stat_type = 'downloads' THEN
        UPDATE public.resumes
        SET downloads = COALESCE(downloads, 0) + 1
        WHERE id = p_resume_id;
    END IF;
END;
$$;

-- Allow resume owners to regenerate their private share token
CREATE OR REPLACE FUNCTION public.regenerate_resume_share_token(
    p_resume_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_token TEXT;
BEGIN
    -- Only the owner can regenerate the private token
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_new_token := encode(gen_random_bytes(16), 'hex');

    UPDATE public.resumes
    SET share_token = v_new_token
    WHERE id = p_resume_id AND user_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resume not found or access denied';
    END IF;

    RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_resume(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_resume_stat(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_resume_share_token(UUID) TO authenticated, service_role;
