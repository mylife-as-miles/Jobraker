-- Migration: Make job_evaluations read-only for authenticated and anon users.
-- Only service_role (trusted backend Edge Functions) may INSERT, UPDATE, or DELETE.

-- 1. Drop existing permissive INSERT and UPDATE policies
DROP POLICY IF EXISTS "Users can insert their own job evaluations" ON public.job_evaluations;
DROP POLICY IF EXISTS "Users can update their own job evaluations" ON public.job_evaluations;
DROP POLICY IF EXISTS "Users can delete their own job evaluations" ON public.job_evaluations;

-- 2. Ensure SELECT policy exists and restricts to row owner
DROP POLICY IF EXISTS "Users can view their own job evaluations" ON public.job_evaluations;
CREATE POLICY "Users can view their own job evaluations"
  ON public.job_evaluations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Revoke mutation privileges at table level from PUBLIC, anon, and authenticated
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.job_evaluations
  FROM PUBLIC, anon, authenticated;

-- 4. Explicitly grant SELECT to authenticated
GRANT SELECT
  ON public.job_evaluations
  TO authenticated;

-- 5. Explicitly grant ALL privileges to service_role
GRANT ALL
  ON public.job_evaluations
  TO service_role;

-- 6. Ensure RLS remains enabled
ALTER TABLE public.job_evaluations ENABLE ROW LEVEL SECURITY;
