-- Durable source material and event history for the AI career commands.
-- The browser accesses these tables only through owner-scoped RLS policies.

create table if not exists public.application_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  archive_path text not null,
  job_posting text,
  resume_snapshot text,
  cover_letter_snapshot text,
  feedback_snapshot jsonb not null default '[]'::jsonb,
  outcome_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, application_id)
);

create index if not exists application_archives_user_updated_idx
  on public.application_archives (user_id, updated_at desc);

create table if not exists public.application_outcome_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type text not null check (event_type in ('interview', 'offer', 'rejected', 'silence', 'follow_up', 'thank_you')),
  stage text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists application_outcome_events_application_created_idx
  on public.application_outcome_events (application_id, created_at desc);

alter table public.application_archives enable row level security;
alter table public.application_outcome_events enable row level security;

drop policy if exists "Users can manage own application archives" on public.application_archives;
create policy "Users can manage own application archives"
  on public.application_archives for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own application outcome events" on public.application_outcome_events;
create policy "Users can manage own application outcome events"
  on public.application_outcome_events for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.application_archives to authenticated;
grant select, insert, update, delete on public.application_outcome_events to authenticated;
