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
create policy if not exists "Select own parsed resumes" on public.parsed_resumes for select using (auth.uid() = user_id);
create policy if not exists "Insert own parsed resumes" on public.parsed_resumes for insert with check (auth.uid() = user_id);
