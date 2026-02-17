-- Add statistics columns to resumes table
ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS public_share_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0;

-- Create function to safely increment stats
CREATE OR REPLACE FUNCTION increment_resume_stat(p_resume_id UUID, p_stat_type TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_stat_type = 'views' THEN
    UPDATE resumes
    SET views = views + 1
    WHERE id = p_resume_id;
  ELSIF p_stat_type = 'downloads' THEN
    UPDATE resumes
    SET downloads = downloads + 1
    WHERE id = p_resume_id;
  ELSE
    RAISE EXCEPTION 'Invalid stat type: %', p_stat_type;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to public/anon/authenticated so it can be called from the frontend
GRANT EXECUTE ON FUNCTION increment_resume_stat(UUID, TEXT) TO public;
GRANT EXECUTE ON FUNCTION increment_resume_stat(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_resume_stat(UUID, TEXT) TO authenticated;
