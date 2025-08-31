-- Add salary period and currency columns to public.job_listings (idempotent)
DO $$
BEGIN
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
END $$;
