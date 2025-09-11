-- Consolidated manual apply for parsed_resumes related changes
-- Apply this once on remote, then mark individual migrations as applied via supabase migration repair

begin;

-- 20250910120000_parsed_resumes.sql
create table if not exists public.parsed_resumes (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid references public.resumes(id) on delete cascade,
  user_id uuid not null,
  raw_text text not null,
  json jsonb,
  extracted_at timestamptz not null default now()
);
create index if not exists parsed_resumes_user_idx on public.parsed_resumes(user_id, extracted_at desc);
create index if not exists parsed_resumes_resume_idx on public.parsed_resumes(resume_id);

alter table public.parsed_resumes enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parsed_resumes' AND policyname='Select own parsed resumes'
  ) THEN
    CREATE POLICY "Select own parsed resumes" ON public.parsed_resumes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parsed_resumes' AND policyname='Insert own parsed resumes'
  ) THEN
    CREATE POLICY "Insert own parsed resumes" ON public.parsed_resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 20250910123000_parsed_resume_enhancements.sql
alter table public.parsed_resumes
  add column if not exists structured jsonb,
  add column if not exists skills text[];
create index if not exists parsed_resumes_skills_idx on public.parsed_resumes using gin (skills);

-- 20250910124500_parsed_resume_embedding.sql
create extension if not exists vector;
alter table public.parsed_resumes add column if not exists embedding vector(256);
-- Optionally create an index later after data volume warrants it
-- create index if not exists parsed_resumes_embedding_idx on public.parsed_resumes using hnsw (embedding vector_l2_ops);

commit;
