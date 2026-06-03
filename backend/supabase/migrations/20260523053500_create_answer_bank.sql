-- Migration: Create answer_bank table and enable realtime
-- Created at: 2026-05-23

-- Idempotent type creation for answer_theme
do $$
begin
  if not exists (select 1 from pg_type where typname = 'answer_theme' and typnamespace = 'public'::regnamespace) then
    create type public.answer_theme as enum (
      'identity',
      'beliefs',
      'stories',
      'career',
      'skills',
      'voice'
    );
  end if;
end $$;

CREATE TABLE IF NOT EXISTS public.answer_bank (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme public.answer_theme NOT NULL,
  slug text NOT NULL,
  question text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  body text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT answer_bank_theme_slug_unique UNIQUE (user_id, theme, slug)
);

CREATE INDEX IF NOT EXISTS answer_bank_user_idx ON public.answer_bank(user_id, theme, slug);

ALTER TABLE public.answer_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select own answer bank entries" ON public.answer_bank;
CREATE POLICY "Select own answer bank entries" ON public.answer_bank FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert own answer bank entries" ON public.answer_bank;
CREATE POLICY "Insert own answer bank entries" ON public.answer_bank FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own answer bank entries" ON public.answer_bank;
CREATE POLICY "Update own answer bank entries" ON public.answer_bank FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own answer bank entries" ON public.answer_bank;
CREATE POLICY "Delete own answer bank entries" ON public.answer_bank FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.answer_bank TO anon, authenticated, service_role;

-- Enable realtime for answer_bank table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'answer_bank'
  ) then
    execute 'alter publication supabase_realtime add table public.answer_bank';
  end if;
end $$;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_answer_bank_updated_at ON public.answer_bank;
CREATE TRIGGER update_answer_bank_updated_at BEFORE UPDATE ON public.answer_bank FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
