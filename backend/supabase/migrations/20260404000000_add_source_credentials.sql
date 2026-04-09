-- Add source_credentials column to store per-domain user credentials securely
ALTER TABLE public.job_source_settings 
ADD COLUMN IF NOT EXISTS source_credentials jsonb DEFAULT '{}'::jsonb;
