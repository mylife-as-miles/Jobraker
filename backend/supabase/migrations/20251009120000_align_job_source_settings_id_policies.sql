-- Align job_source_settings to use id (PK = auth.uid()) instead of user_id, and update RLS policies.
-- Safe to run multiple times: guards check existence before dropping.

DO $$
BEGIN
  -- Drop legacy policies if they exist (they reference user_id)
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='Users can view their own job source settings'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view their own job source settings" ON public.job_source_settings';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='Users can insert their own job source settings'
  ) THEN
    EXECUTE 'DROP POLICY "Users can insert their own job source settings" ON public.job_source_settings';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='Users can update their own job source settings'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update their own job source settings" ON public.job_source_settings';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='Users can delete their own job source settings'
  ) THEN
    EXECUTE 'DROP POLICY "Users can delete their own job source settings" ON public.job_source_settings';
  END IF;

  -- Drop legacy index on user_id if present
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='job_source_settings' AND indexname='idx_job_source_settings_user_id'
  ) THEN
    EXECUTE 'DROP INDEX public.idx_job_source_settings_user_id';
  END IF;

  -- Backfill: set id = user_id if they differ, before dropping column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_source_settings' AND column_name='user_id'
  ) THEN
    -- Use dynamic SQL to avoid issues if column already dropped in some envs
    EXECUTE 'UPDATE public.job_source_settings SET id = user_id WHERE id IS DISTINCT FROM user_id';
  END IF;

  -- Drop user_id column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_source_settings' AND column_name='user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.job_source_settings DROP COLUMN user_id';
  END IF;
END $$;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.job_source_settings ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies based on id = auth.uid() (create-if-missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='job_source_settings_select_own_by_id'
  ) THEN
    EXECUTE 'CREATE POLICY "job_source_settings_select_own_by_id" ON public.job_source_settings FOR SELECT USING (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='job_source_settings_insert_own_by_id'
  ) THEN
    EXECUTE 'CREATE POLICY "job_source_settings_insert_own_by_id" ON public.job_source_settings FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='job_source_settings_update_own_by_id'
  ) THEN
    EXECUTE 'CREATE POLICY "job_source_settings_update_own_by_id" ON public.job_source_settings FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_source_settings' AND policyname='job_source_settings_delete_own_by_id'
  ) THEN
    EXECUTE 'CREATE POLICY "job_source_settings_delete_own_by_id" ON public.job_source_settings FOR DELETE USING (auth.uid() = id)';
  END IF;
END $$;
