-- Consolidated, idempotent SQL to apply pending schema on remote Supabase
-- Includes: salary_period/currency columns on job_listings, job_source_settings table, RLS policies, and realtime publication.

-- 1) Add salary fields on job_listings if table exists and columns are missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='job_listings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='job_listings' AND column_name='salary_period'
    ) THEN
      ALTER TABLE public.job_listings
        ADD COLUMN salary_period text NULL; -- e.g., hour, day, week, month, year
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='job_listings' AND column_name='salary_currency'
    ) THEN
      ALTER TABLE public.job_listings
        ADD COLUMN salary_currency text NULL; -- e.g., USD, EUR, GBP
    END IF;
  END IF;
END $$;

-- 2) Ensure job_source_settings exists with expected columns
CREATE TABLE IF NOT EXISTS public.job_source_settings (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  include_linkedin boolean NOT NULL DEFAULT true,
  include_indeed boolean NOT NULL DEFAULT true,
  include_search boolean NOT NULL DEFAULT true,
  allowed_domains text[] NULL,
  enabled_sources text[] NULL, -- e.g., {'deepresearch','remotive','remoteok','arbeitnow'}
  updated_at timestamptz DEFAULT now()
);

-- 3) Enable RLS and (re)create self-access policies (idempotent)
ALTER TABLE public.job_source_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='Read own job sources'
  ) THEN
    DROP POLICY "Read own job sources" ON public.job_source_settings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='Insert own job sources'
  ) THEN
    DROP POLICY "Insert own job sources" ON public.job_source_settings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='Update own job sources'
  ) THEN
    DROP POLICY "Update own job sources" ON public.job_source_settings;
  END IF;
END $$;

CREATE POLICY "Read own job sources" ON public.job_source_settings
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Insert own job sources" ON public.job_source_settings
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Update own job sources" ON public.job_source_settings
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 4) Add to realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'job_source_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_source_settings;
  END IF;
END $$;

-- Done.
