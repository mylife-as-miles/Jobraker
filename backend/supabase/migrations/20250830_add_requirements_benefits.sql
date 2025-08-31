-- Add JSONB requirements and benefits to public.job_listings (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='job_listings' AND column_name='requirements'
  ) THEN
    ALTER TABLE public.job_listings
      ADD COLUMN requirements jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='job_listings' AND column_name='benefits'
  ) THEN
    ALTER TABLE public.job_listings
      ADD COLUMN benefits jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Optional: GIN indexes to speed containment and search (safe if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='job_listings' AND indexname='job_listings_requirements_gin'
  ) THEN
    CREATE INDEX job_listings_requirements_gin ON public.job_listings USING gin (requirements jsonb_path_ops);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='job_listings' AND indexname='job_listings_benefits_gin'
  ) THEN
    CREATE INDEX job_listings_benefits_gin ON public.job_listings USING gin (benefits jsonb_path_ops);
  END IF;
END $$;
