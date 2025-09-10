-- Parsed resume structured data table
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
