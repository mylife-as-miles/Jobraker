-- Create a per-user job source configuration table to persist Settings > Job Sources
-- Idempotent migration: safe to run multiple times

-- Table
create table if not exists public.job_source_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sources jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.job_source_configs is 'Per-user job ingestion source configuration stored as JSON array';
comment on column public.job_source_configs.sources is 'Array of { id:number, type:string, query:string, enabled:boolean }';

-- Helpful index
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and tablename='job_source_configs' and indexname='job_source_configs_updated_at_idx'
  ) then
    create index job_source_configs_updated_at_idx on public.job_source_configs(updated_at desc);
  end if;
end $$;

-- updated_at trigger (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'set_updated_at' and n.nspname = 'public'
  ) then
    create function public.set_updated_at() returns trigger language plpgsql as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'job_source_configs_set_updated_at'
  ) then
    create trigger job_source_configs_set_updated_at
    before update on public.job_source_configs
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS
alter table public.job_source_configs enable row level security;

-- Policies (idempotent guards)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='job_source_configs' and policyname='job_source_configs_select_own'
  ) then
    create policy job_source_configs_select_own on public.job_source_configs
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='job_source_configs' and policyname='job_source_configs_insert_own'
  ) then
    create policy job_source_configs_insert_own on public.job_source_configs
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='job_source_configs' and policyname='job_source_configs_update_own'
  ) then
    create policy job_source_configs_update_own on public.job_source_configs
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='job_source_configs' and policyname='job_source_configs_delete_own'
  ) then
    create policy job_source_configs_delete_own on public.job_source_configs
      for delete using (auth.uid() = user_id);
  end if;
end $$;
