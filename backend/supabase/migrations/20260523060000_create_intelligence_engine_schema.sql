-- Migration: Create intelligence engine profile evidence graph schema
-- Created at: 2026-05-23

-- 1. Profile Entities Table
CREATE TABLE IF NOT EXISTS public.profile_entities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  name text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_entities_user_type_name_unique UNIQUE (user_id, entity_type, name)
);

CREATE INDEX IF NOT EXISTS profile_entities_user_type_idx ON public.profile_entities (user_id, entity_type);

ALTER TABLE public.profile_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile entities" ON public.profile_entities;
CREATE POLICY "Users can manage own profile entities"
  ON public.profile_entities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Profile Edges Table
CREATE TABLE IF NOT EXISTS public.profile_edges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_entity_id uuid NOT NULL REFERENCES public.profile_entities(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES public.profile_entities(id) ON DELETE CASCADE,
  edge_type text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_edges_user_source_target_type_unique UNIQUE (user_id, source_entity_id, target_entity_id, edge_type)
);

CREATE INDEX IF NOT EXISTS profile_edges_user_source_idx ON public.profile_edges (user_id, source_entity_id);
CREATE INDEX IF NOT EXISTS profile_edges_user_target_idx ON public.profile_edges (user_id, target_entity_id);

ALTER TABLE public.profile_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile edges" ON public.profile_edges;
CREATE POLICY "Users can manage own profile edges"
  ON public.profile_edges FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Profile Evidence Items Table
CREATE TABLE IF NOT EXISTS public.profile_evidence_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid REFERENCES public.profile_entities(id) ON DELETE SET NULL,
  evidence_type text NOT NULL,
  text text NOT NULL,
  normalized_text text,
  skills_mentioned text[] NOT NULL DEFAULT '{}'::text[],
  tools_mentioned text[] NOT NULL DEFAULT '{}'::text[],
  role_signals text[] NOT NULL DEFAULT '{}'::text[],
  seniority_signals text[] NOT NULL DEFAULT '{}'::text[],
  source_table text,
  source_id uuid,
  confidence numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_evidence_items_user_entity_idx ON public.profile_evidence_items (user_id, entity_id);

ALTER TABLE public.profile_evidence_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile evidence items" ON public.profile_evidence_items;
CREATE POLICY "Users can manage own profile evidence items"
  ON public.profile_evidence_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Candidate Skill Signals Table
CREATE TABLE IF NOT EXISTS public.candidate_skill_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  evidence_strength integer NOT NULL DEFAULT 0,
  experience_years numeric NOT NULL DEFAULT 0,
  recency_months integer,
  frequency_count integer NOT NULL DEFAULT 0,
  outcome_confidence integer NOT NULL DEFAULT 50,
  sources_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_skill_signals_user_skill_unique UNIQUE (user_id, skill_name)
);

CREATE INDEX IF NOT EXISTS candidate_skill_signals_user_strength_idx ON public.candidate_skill_signals (user_id, evidence_strength DESC);

ALTER TABLE public.candidate_skill_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own skill signals" ON public.candidate_skill_signals;
CREATE POLICY "Users can manage own skill signals"
  ON public.candidate_skill_signals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Candidate Role Preferences Table
CREATE TABLE IF NOT EXISTS public.candidate_role_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_title text NOT NULL,
  min_salary numeric,
  max_salary numeric,
  salary_currency text DEFAULT 'USD',
  preferred_locations text[] NOT NULL DEFAULT '{}'::text[],
  preferred_remote_types text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_role_preferences_user_title_unique UNIQUE (user_id, target_title)
);

ALTER TABLE public.candidate_role_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own role preferences" ON public.candidate_role_preferences;
CREATE POLICY "Users can manage own role preferences"
  ON public.candidate_role_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Candidate Feedback Events Table
CREATE TABLE IF NOT EXISTS public.candidate_feedback_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_value text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_feedback_events_user_idx ON public.candidate_feedback_events (user_id, created_at DESC);

ALTER TABLE public.candidate_feedback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own feedback events" ON public.candidate_feedback_events;
CREATE POLICY "Users can manage own feedback events"
  ON public.candidate_feedback_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profile_entities_updated_at ON public.profile_entities;
CREATE TRIGGER update_profile_entities_updated_at BEFORE UPDATE ON public.profile_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_edges_updated_at ON public.profile_edges;
CREATE TRIGGER update_profile_edges_updated_at BEFORE UPDATE ON public.profile_edges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_evidence_items_updated_at ON public.profile_evidence_items;
CREATE TRIGGER update_profile_evidence_items_updated_at BEFORE UPDATE ON public.profile_evidence_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_skill_signals_updated_at ON public.candidate_skill_signals;
CREATE TRIGGER update_candidate_skill_signals_updated_at BEFORE UPDATE ON public.candidate_skill_signals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_role_preferences_updated_at ON public.candidate_role_preferences;
CREATE TRIGGER update_candidate_role_preferences_updated_at BEFORE UPDATE ON public.candidate_role_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants
GRANT ALL ON TABLE public.profile_entities TO authenticated, service_role;
GRANT ALL ON TABLE public.profile_edges TO authenticated, service_role;
GRANT ALL ON TABLE public.profile_evidence_items TO authenticated, service_role;
GRANT ALL ON TABLE public.candidate_skill_signals TO authenticated, service_role;
GRANT ALL ON TABLE public.candidate_role_preferences TO authenticated, service_role;
GRANT ALL ON TABLE public.candidate_feedback_events TO authenticated, service_role;
