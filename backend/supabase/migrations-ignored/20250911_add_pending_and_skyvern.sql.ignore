-- Add Pending to applications.status constraint (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_status_check') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'applications_status_check'
        AND pg_get_constraintdef(c.oid) ILIKE '%Pending%'
    ) THEN
      ALTER TABLE public.applications DROP CONSTRAINT applications_status_check;
      ALTER TABLE public.applications
        ADD CONSTRAINT applications_status_check
        CHECK (status IN ('Pending','Applied','Interview','Offer','Rejected','Withdrawn'));
    END IF;
  ELSE
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_status_check
      CHECK (status IN ('Pending','Applied','Interview','Offer','Rejected','Withdrawn'));
  END IF;
END $$;
-- Add Skyvern tracking columns if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications' AND column_name='run_id'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN run_id text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications' AND column_name='workflow_id'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN workflow_id text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications' AND column_name='app_url'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN app_url text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications' AND column_name='provider_status'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN provider_status text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications' AND column_name='recording_url'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN recording_url text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications' AND column_name='failure_reason'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN failure_reason text;
  END IF;
END $$;
-- Helpful index for webhook updates
CREATE INDEX IF NOT EXISTS applications_run_id_idx ON public.applications (run_id);
