-- Resume versions ledger
-- Intent: Track immutable snapshots of resume file & parse-derived metadata for rollback / diff.
-- Rollback: DROP TABLE public.resume_versions (safe if feature not yet relied upon by other FKs).

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  user_id uuid not null,
  parent_id uuid null references public.resume_versions(id) on delete set null,
  storage_path text not null,
  sha256 char(64) not null,
  parsed_snapshot jsonb, -- optional structured parse snapshot to diff without reprocessing
  diff_meta jsonb,       -- summary: { approx_added: number, approx_removed: number }
  created_at timestamptz not null default now()
);
create index if not exists resume_versions_resume_idx on public.resume_versions(resume_id, created_at desc);
create index if not exists resume_versions_user_idx on public.resume_versions(user_id, created_at desc);
create unique index if not exists resume_versions_resume_sha_idx on public.resume_versions(resume_id, sha256);

alter table public.resume_versions enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='resume_versions' AND policyname='Select own resume versions'
  ) THEN
    CREATE POLICY "Select own resume versions" ON public.resume_versions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='resume_versions' AND policyname='Insert own resume versions'
  ) THEN
    CREATE POLICY "Insert own resume versions" ON public.resume_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
