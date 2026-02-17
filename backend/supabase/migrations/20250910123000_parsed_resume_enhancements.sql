-- Add structured JSON fields and keyword index to parsed_resumes
alter table public.parsed_resumes
  add column if not exists structured jsonb,
  add column if not exists skills text[];
-- Simple GIN index for searching skills
create index if not exists parsed_resumes_skills_idx on public.parsed_resumes using gin (skills);
