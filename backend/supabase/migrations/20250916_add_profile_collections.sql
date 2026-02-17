-- Migration: Add profile related collection tables (experiences, education, skills)
-- Created at: 2025-09-16

-- Experiences
CREATE TABLE IF NOT EXISTS public.profile_experiences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  company text NOT NULL DEFAULT ''::text,
  location text DEFAULT ''::text,
  start_date date NOT NULL,
  end_date date,
  is_current boolean DEFAULT false NOT NULL,
  description text DEFAULT ''::text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_experiences_user_idx ON public.profile_experiences(user_id, start_date DESC);
ALTER TABLE public.profile_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select own profile experiences" ON public.profile_experiences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own profile experiences" ON public.profile_experiences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own profile experiences" ON public.profile_experiences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own profile experiences" ON public.profile_experiences FOR DELETE USING (auth.uid() = user_id);
GRANT ALL ON TABLE public.profile_experiences TO anon, authenticated, service_role;
-- Education
CREATE TABLE IF NOT EXISTS public.profile_education (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  degree text NOT NULL,
  school text NOT NULL,
  location text DEFAULT ''::text,
  start_date date NOT NULL,
  end_date date,
  gpa text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_education_user_idx ON public.profile_education(user_id, start_date DESC);
ALTER TABLE public.profile_education ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select own profile education" ON public.profile_education FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own profile education" ON public.profile_education FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own profile education" ON public.profile_education FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own profile education" ON public.profile_education FOR DELETE USING (auth.uid() = user_id);
GRANT ALL ON TABLE public.profile_education TO anon, authenticated, service_role;
-- Skills (simple flat list for now)
CREATE TABLE IF NOT EXISTS public.profile_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text CHECK (level IN ('Beginner','Intermediate','Advanced','Expert')),
  category text DEFAULT ''::text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_skills_user_idx ON public.profile_skills(user_id, name);
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select own profile skills" ON public.profile_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own profile skills" ON public.profile_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own profile skills" ON public.profile_skills FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own profile skills" ON public.profile_skills FOR DELETE USING (auth.uid() = user_id);
GRANT ALL ON TABLE public.profile_skills TO anon, authenticated, service_role;
