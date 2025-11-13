-- Add enabled_default_sources column to job_source_settings table
-- This column stores which of the 5 default job sources are enabled/disabled
-- Default sources: remote.co, remotive.com, remoteok.com, jobicy.com, levels.fyi

BEGIN;

-- Add enabled_default_sources column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_source_settings' 
    AND column_name = 'enabled_default_sources'
  ) THEN
    ALTER TABLE public.job_source_settings
      ADD COLUMN enabled_default_sources text[] DEFAULT ARRAY['remote.co', 'remotive.com', 'remoteok.com', 'jobicy.com', 'levels.fyi']::text[];
    
    -- Add comment
    COMMENT ON COLUMN public.job_source_settings.enabled_default_sources IS 'Array of enabled default job source domains. Valid values: remote.co, remotive.com, remoteok.com, jobicy.com, levels.fyi';
  END IF;
END $$;

-- Migrate existing data from allowed_domains to enabled_default_sources
-- Extract default sources that are currently in allowed_domains
DO $$
DECLARE
  rec RECORD;
  default_sources text[] := ARRAY['remote.co', 'remotive.com', 'remoteok.com', 'jobicy.com', 'levels.fyi'];
  enabled_defaults text[];
BEGIN
  FOR rec IN 
    SELECT id, allowed_domains, enabled_default_sources
    FROM public.job_source_settings
    WHERE allowed_domains IS NOT NULL
    AND (enabled_default_sources IS NULL OR array_length(enabled_default_sources, 1) IS NULL)
  LOOP
    -- Find which default sources are in allowed_domains
    enabled_defaults := ARRAY[]::text[];
    
    -- Check each default source
    IF 'remote.co' = ANY(rec.allowed_domains) THEN
      enabled_defaults := array_append(enabled_defaults, 'remote.co');
    END IF;
    IF 'remotive.com' = ANY(rec.allowed_domains) THEN
      enabled_defaults := array_append(enabled_defaults, 'remotive.com');
    END IF;
    IF 'remoteok.com' = ANY(rec.allowed_domains) THEN
      enabled_defaults := array_append(enabled_defaults, 'remoteok.com');
    END IF;
    IF 'jobicy.com' = ANY(rec.allowed_domains) THEN
      enabled_defaults := array_append(enabled_defaults, 'jobicy.com');
    END IF;
    IF 'levels.fyi' = ANY(rec.allowed_domains) THEN
      enabled_defaults := array_append(enabled_defaults, 'levels.fyi');
    END IF;
    
    -- If no defaults found, set to all enabled (default state)
    IF array_length(enabled_defaults, 1) IS NULL THEN
      enabled_defaults := default_sources;
    END IF;
    
    -- Update the enabled_default_sources column
    UPDATE public.job_source_settings
    SET enabled_default_sources = enabled_defaults
    WHERE id = rec.id;
  END LOOP;
END $$;

COMMIT;

