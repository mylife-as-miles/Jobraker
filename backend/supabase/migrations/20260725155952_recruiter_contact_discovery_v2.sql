create table if not exists public.recruiter_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  company text not null,
  job_title text,
  team_keywords text[] not null default '{}',
  official_domain text,
  careers_page_url text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'partial', 'failed')),
  query_plan jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recruiter_discovery_runs is
  'Auditable recruiter and hiring-team discovery runs initiated by JobRaker AI Chat.';

create table if not exists public.recruiter_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discovery_run_id uuid references public.recruiter_discovery_runs(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  identity_key text not null,
  company text not null,
  full_name text not null,
  title text,
  role_kind text not null default 'unknown'
    check (role_kind in ('recruiter', 'hiring_manager', 'team_lead', 'director', 'employee', 'unknown')),
  linkedin_url text,
  linkedin_source_url text,
  work_email text,
  email_status text not null default 'not_found'
    check (email_status in ('source_verified', 'provider_verified', 'domain_valid', 'pattern_only', 'unverified', 'not_found')),
  email_confidence numeric(4,3) not null default 0
    check (email_confidence >= 0 and email_confidence <= 1),
  email_source_url text,
  relevance_score integer not null default 0
    check (relevance_score >= 0 and relevance_score <= 100),
  evidence jsonb not null default '[]'::jsonb,
  safe_to_contact boolean not null default false,
  discovered_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, identity_key)
);

comment on table public.recruiter_contacts is
  'Publicly discovered recruiter or hiring-team contacts with explicit source and verification evidence. Pattern-only email guesses are never marked safe to contact.';

create index if not exists recruiter_discovery_runs_user_created_idx
  on public.recruiter_discovery_runs (user_id, created_at desc);
create index if not exists recruiter_discovery_runs_job_idx
  on public.recruiter_discovery_runs (job_id, created_at desc)
  where job_id is not null;
create index if not exists recruiter_discovery_runs_company_idx
  on public.recruiter_discovery_runs (user_id, lower(company), created_at desc);

create index if not exists recruiter_contacts_user_relevance_idx
  on public.recruiter_contacts (user_id, relevance_score desc, discovered_at desc);
create index if not exists recruiter_contacts_job_idx
  on public.recruiter_contacts (job_id, relevance_score desc)
  where job_id is not null;
create index if not exists recruiter_contacts_run_idx
  on public.recruiter_contacts (discovery_run_id, relevance_score desc)
  where discovery_run_id is not null;
create index if not exists recruiter_contacts_safe_idx
  on public.recruiter_contacts (user_id, safe_to_contact, relevance_score desc);
create index if not exists recruiter_contacts_company_idx
  on public.recruiter_contacts (user_id, lower(company), relevance_score desc);

alter table public.recruiter_discovery_runs enable row level security;
alter table public.recruiter_contacts enable row level security;

revoke all on table public.recruiter_discovery_runs from anon;
revoke all on table public.recruiter_contacts from anon;

grant select, insert, update, delete on table public.recruiter_discovery_runs to authenticated;
grant select, insert, update, delete on table public.recruiter_contacts to authenticated;
grant all on table public.recruiter_discovery_runs to service_role;
grant all on table public.recruiter_contacts to service_role;

drop policy if exists "Users can view their recruiter discovery runs" on public.recruiter_discovery_runs;
create policy "Users can view their recruiter discovery runs"
  on public.recruiter_discovery_runs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their recruiter discovery runs" on public.recruiter_discovery_runs;
create policy "Users can create their recruiter discovery runs"
  on public.recruiter_discovery_runs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their recruiter discovery runs" on public.recruiter_discovery_runs;
create policy "Users can update their recruiter discovery runs"
  on public.recruiter_discovery_runs
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their recruiter discovery runs" on public.recruiter_discovery_runs;
create policy "Users can delete their recruiter discovery runs"
  on public.recruiter_discovery_runs
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their recruiter contacts" on public.recruiter_contacts;
create policy "Users can view their recruiter contacts"
  on public.recruiter_contacts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their recruiter contacts" on public.recruiter_contacts;
create policy "Users can create their recruiter contacts"
  on public.recruiter_contacts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their recruiter contacts" on public.recruiter_contacts;
create policy "Users can update their recruiter contacts"
  on public.recruiter_contacts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their recruiter contacts" on public.recruiter_contacts;
create policy "Users can delete their recruiter contacts"
  on public.recruiter_contacts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
