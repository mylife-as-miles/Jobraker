-- Per-user job source settings
create table if not exists public.job_source_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  include_linkedin boolean not null default true,
  include_indeed boolean not null default true,
  include_search boolean not null default true,
  allowed_domains text[] null,
  enabled_sources text[] null, -- e.g., {'deepresearch','remotive','remoteok','arbeitnow'}
  updated_at timestamptz default now()
);
alter table public.job_source_settings enable row level security;
-- RLS policies: read/insert/update own settings
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='job_source_settings' and policyname='Read own job sources') then
    drop policy "Read own job sources" on public.job_source_settings;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='job_source_settings' and policyname='Insert own job sources') then
    drop policy "Insert own job sources" on public.job_source_settings;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='job_source_settings' and policyname='Update own job sources') then
    drop policy "Update own job sources" on public.job_source_settings;
  end if;
end $$;
create policy "Read own job sources" on public.job_source_settings
  for select using (auth.uid() = id);
create policy "Insert own job sources" on public.job_source_settings
  for insert with check (auth.uid() = id);
create policy "Update own job sources" on public.job_source_settings
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- Enable realtime (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_source_settings'
  ) then
    alter publication supabase_realtime add table public.job_source_settings;
  end if;
end $$;
