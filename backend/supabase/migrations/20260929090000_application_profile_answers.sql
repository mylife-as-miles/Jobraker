-- Application profile (Phase 3): the answers a user gives once to common
-- application questions. One row per canonical question key (the keys used by
-- the ATS question census, e.g. current_salary, notice_period,
-- work_authorization). Value shapes are defined in
-- backend/supabase/shared/application-profile.ts.
--
-- Additive: the existing profiles eligibility columns stay as the fallback
-- until a user saves their application profile.

CREATE TABLE IF NOT EXISTS public.application_profile_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  value jsonb NOT NULL,
  -- user: typed in the profile page; resume: prefilled and confirmed;
  -- popup: answered when an auto-apply run asked.
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'resume', 'popup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

ALTER TABLE public.application_profile_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own application profile answers" ON public.application_profile_answers;
CREATE POLICY "Users manage own application profile answers" ON public.application_profile_answers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_profile_answers TO authenticated;
GRANT ALL ON public.application_profile_answers TO service_role;
