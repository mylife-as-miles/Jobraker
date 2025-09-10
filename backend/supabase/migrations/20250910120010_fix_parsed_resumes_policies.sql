-- Fix parsed_resumes RLS policies (replace invalid "create policy if not exists" usage)
-- Postgres does not support IF NOT EXISTS on CREATE POLICY, so we guard with DO blocks.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parsed_resumes' AND policyname = 'Select own parsed resumes'
  ) THEN
    CREATE POLICY "Select own parsed resumes" ON public.parsed_resumes
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parsed_resumes' AND policyname = 'Insert own parsed resumes'
  ) THEN
    CREATE POLICY "Insert own parsed resumes" ON public.parsed_resumes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
