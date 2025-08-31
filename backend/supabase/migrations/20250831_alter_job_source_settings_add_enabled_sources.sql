DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='job_source_settings'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='job_source_settings' AND column_name='enabled_sources'
  ) THEN
    ALTER TABLE public.job_source_settings
      ADD COLUMN enabled_sources text[] NULL; -- e.g., {'deepresearch','remotive','remoteok','arbeitnow'}
  END IF;
END $$;
