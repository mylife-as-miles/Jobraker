-- Add public_share_enabled column to resumes table
ALTER TABLE public.resumes 
ADD COLUMN IF NOT EXISTS public_share_enabled boolean NOT NULL DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS resumes_public_share_idx ON public.resumes(public_share_enabled);

-- Enable RLS (already enabled, but good practice to ensure)
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to resumes where public_share_enabled is true
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'resumes' AND policyname = 'Public can view shared resumes'
  ) THEN
    CREATE POLICY "Public can view shared resumes"
    ON public.resumes
    FOR SELECT
    USING (public_share_enabled = true);
  END IF;
END $$;
