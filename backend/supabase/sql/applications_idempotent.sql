BEGIN;

-- Table
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_title text NOT NULL,
  company text NOT NULL,
  location text DEFAULT ''::text,
  applied_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Applied'::text,
  salary text,
  notes text,
  next_step text,
  interview_date timestamptz,
  logo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Primary key (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_pkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Foreign key (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_user_id_fkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Status check (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_status_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_status_check
      CHECK (status IN ('Applied','Interview','Offer','Rejected','Withdrawn'));
  END IF;
END $$;

-- Index (idempotent)
CREATE INDEX IF NOT EXISTS applications_user_updated_idx
  ON public.applications (user_id, updated_at DESC);

-- RLS (safe to re-run)
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='applications' AND policyname='Select own applications') THEN
    CREATE POLICY "Select own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='applications' AND policyname='Insert own applications') THEN
    CREATE POLICY "Insert own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='applications' AND policyname='Update own applications') THEN
    CREATE POLICY "Update own applications" ON public.applications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='applications' AND policyname='Delete own applications') THEN
    CREATE POLICY "Delete own applications" ON public.applications FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Grants (safe to re-run)
GRANT ALL ON TABLE public.applications TO anon;
GRANT ALL ON TABLE public.applications TO authenticated;
GRANT ALL ON TABLE public.applications TO service_role;

COMMIT;
