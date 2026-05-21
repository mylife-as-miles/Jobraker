CREATE TABLE IF NOT EXISTS public.user_experience_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  source text NOT NULL DEFAULT 'dashboard_prompt',
  prompt_version text NOT NULL DEFAULT 'v1',
  context_path text,
  utm_source text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS user_experience_feedback_user_created_idx
  ON public.user_experience_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_experience_feedback_created_idx
  ON public.user_experience_feedback (created_at DESC);

ALTER TABLE public.user_experience_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback, admins can view all feedback" ON public.user_experience_feedback;
CREATE POLICY "Users can view own feedback, admins can view all feedback"
  ON public.user_experience_feedback
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.user_experience_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.user_experience_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all feedback" ON public.user_experience_feedback;
CREATE POLICY "Admins can manage all feedback"
  ON public.user_experience_feedback
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.user_experience_feedback TO authenticated;
GRANT ALL ON public.user_experience_feedback TO service_role;
