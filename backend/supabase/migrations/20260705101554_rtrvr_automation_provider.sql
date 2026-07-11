-- rtrvr primary automation provider, durable attempts, and user browser-mode preferences.

alter table public.profiles
  add column if not exists browser_execution_preference text not null default 'automatic',
  add column if not exists rtrvr_device_id text,
  add column if not exists rtrvr_prefer_extension boolean not null default true,
  add column if not exists auto_apply_auto_submit boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_browser_execution_preference_check'
  ) then
    alter table public.profiles
      add constraint profiles_browser_execution_preference_check
      check (browser_execution_preference in ('automatic', 'my_chrome', 'jobraker_cloud'));
  end if;
end $$;

comment on column public.profiles.browser_execution_preference is
  'Preferred browser execution mode for governed auto-apply: automatic, my_chrome, or jobraker_cloud.';
comment on column public.profiles.rtrvr_device_id is
  'Optional rtrvr browser extension device id selected by the user.';
comment on column public.profiles.rtrvr_prefer_extension is
  'When browser_execution_preference is automatic, prefer local Chrome before cloud when available.';
comment on column public.profiles.auto_apply_auto_submit is
  'Whether governed auto-apply may perform the final irreversible submit action.';

alter table public.applications
  add column if not exists automation_provider text,
  add column if not exists automation_idempotency_key text,
  add column if not exists automation_requested_mode text,
  add column if not exists automation_selected_mode text,
  add column if not exists automation_fallback_applied boolean not null default false,
  add column if not exists automation_fallback_reason text,
  add column if not exists automation_device_id text,
  add column if not exists automation_claimed_by text,
  add column if not exists automation_lease_token uuid,
  add column if not exists automation_lease_expires_at timestamptz,
  add column if not exists automation_heartbeat_at timestamptz,
  add column if not exists automation_attempt_number integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_automation_provider_check'
  ) then
    alter table public.applications
      add constraint applications_automation_provider_check
      check (automation_provider is null or automation_provider in ('rtrvr', 'skyvern'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_automation_requested_mode_check'
  ) then
    alter table public.applications
      add constraint applications_automation_requested_mode_check
      check (automation_requested_mode is null or automation_requested_mode in ('automatic', 'my_chrome', 'jobraker_cloud'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_automation_selected_mode_check'
  ) then
    alter table public.applications
      add constraint applications_automation_selected_mode_check
      check (automation_selected_mode is null or automation_selected_mode in ('extension', 'cloud'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_automation_attempt_number_check'
  ) then
    alter table public.applications
      add constraint applications_automation_attempt_number_check
      check (automation_attempt_number >= 0);
  end if;
end $$;

create unique index if not exists applications_automation_idempotency_key_idx
  on public.applications (automation_idempotency_key)
  where automation_idempotency_key is not null;

create index if not exists applications_rtrvr_queue_idx
  on public.applications (provider_status, updated_at)
  where automation_provider = 'rtrvr' and canonical_stage = 'queued';

create index if not exists applications_rtrvr_lease_idx
  on public.applications (provider_status, automation_lease_expires_at)
  where automation_provider = 'rtrvr' and canonical_stage = 'queued';

comment on column public.applications.automation_provider is
  'Current automation provider responsible for the application run.';
comment on column public.applications.automation_idempotency_key is
  'Deterministic guard preventing concurrent duplicate submissions for the same application.';
comment on column public.applications.automation_requested_mode is
  'User browser execution preference requested for this automation run.';
comment on column public.applications.automation_selected_mode is
  'Actual rtrvr execution mode selected by provider routing.';
comment on column public.applications.automation_fallback_applied is
  'True when the automation safely fell back from rtrvr to Skyvern.';
comment on column public.applications.automation_fallback_reason is
  'Safe, user-readable reason fallback was allowed.';
comment on column public.applications.automation_device_id is
  'rtrvr extension device id used for a local-browser run, when any.';
comment on column public.applications.automation_claimed_by is
  'Automation worker id that currently owns the rtrvr application lease.';
comment on column public.applications.automation_lease_token is
  'Opaque fencing token required for lease renewal and terminal rtrvr worker writes.';
comment on column public.applications.automation_lease_expires_at is
  'Time after which an unfinished rtrvr application can be reclaimed by another worker.';
comment on column public.applications.automation_heartbeat_at is
  'Most recent heartbeat from the worker that owns the rtrvr lease.';
comment on column public.applications.automation_attempt_number is
  'Monotonic rtrvr worker execution attempt counter for this application row.';

create table if not exists public.application_automation_attempts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  agent_run_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('rtrvr', 'skyvern')),
  attempt_number integer not null check (attempt_number > 0),
  target_mode text,
  selected_mode text,
  provider_run_id text,
  provider_request_id text,
  provider_status text,
  status text not null check (
    status in ('queued', 'running', 'waiting_for_user', 'retrying', 'needs_review', 'failed', 'completed', 'cancelled')
  ),
  claimed_by text,
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  fallback_applied boolean not null default false,
  fallback_reason text,
  device_id text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_code text,
  failure_message text,
  result jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.application_automation_attempts
  add column if not exists claimed_by text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz;

alter table public.application_automation_attempts enable row level security;

drop policy if exists "Users can read own automation attempts" on public.application_automation_attempts;
create policy "Users can read own automation attempts"
  on public.application_automation_attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role can manage automation attempts" on public.application_automation_attempts;
create policy "Service role can manage automation attempts"
  on public.application_automation_attempts
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists application_automation_attempts_application_idx
  on public.application_automation_attempts (application_id, created_at desc);
create index if not exists application_automation_attempts_user_idx
  on public.application_automation_attempts (user_id, created_at desc);
create index if not exists application_automation_attempts_provider_run_idx
  on public.application_automation_attempts (provider, provider_run_id)
  where provider_run_id is not null;

grant select on public.application_automation_attempts to authenticated;
grant all on public.application_automation_attempts to service_role;

create table if not exists public.automation_worker_nonces (
  nonce text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.automation_worker_nonces enable row level security;

drop policy if exists "Service role can manage automation worker nonces" on public.automation_worker_nonces;
create policy "Service role can manage automation worker nonces"
  on public.automation_worker_nonces
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists automation_worker_nonces_expires_idx
  on public.automation_worker_nonces (expires_at);

grant all on public.automation_worker_nonces to service_role;

create or replace function public.claim_automation_worker_nonce(
  p_nonce text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
begin
  if nullif(trim(p_nonce), '') is null or p_expires_at <= now() then
    return false;
  end if;

  delete from public.automation_worker_nonces
  where expires_at < now();

  insert into public.automation_worker_nonces (nonce, expires_at)
  values (trim(p_nonce), p_expires_at)
  on conflict (nonce) do nothing
  returning true into v_inserted;

  return coalesce(v_inserted, false);
end;
$$;

revoke all on function public.claim_automation_worker_nonce(text, timestamptz) from public;
grant execute on function public.claim_automation_worker_nonce(text, timestamptz) to service_role;

create table if not exists public.rtrvr_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  application_id uuid references public.applications(id) on delete set null,
  provider_request_id text,
  provider_run_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.rtrvr_webhook_events enable row level security;

drop policy if exists "Service role can manage rtrvr webhook events" on public.rtrvr_webhook_events;
create policy "Service role can manage rtrvr webhook events"
  on public.rtrvr_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists rtrvr_webhook_events_application_idx
  on public.rtrvr_webhook_events (application_id, received_at desc);
create index if not exists rtrvr_webhook_events_provider_request_idx
  on public.rtrvr_webhook_events (provider_request_id)
  where provider_request_id is not null;

grant all on public.rtrvr_webhook_events to service_role;

drop function if exists public.claim_next_rtrvr_auto_apply_jobs(integer);
drop function if exists public.claim_next_rtrvr_auto_apply_jobs(integer, text, integer);

create or replace function public.claim_next_rtrvr_auto_apply_jobs(
  p_limit integer default 3,
  p_worker_id text default null,
  p_lease_seconds integer default 900
)
returns table (application_id uuid, attempt_number integer, lease_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id text := coalesce(nullif(trim(p_worker_id), ''), 'automation-worker');
  v_lease interval := make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 900), 3600)));
begin
  p_limit := greatest(1, least(coalesce(p_limit, 3), 25));

  return query
  with candidates as (
    select a.id
    from public.applications a
    where a.canonical_stage = 'queued'
      and coalesce(a.automation_provider, 'rtrvr') = 'rtrvr'
      and (
        coalesce(a.provider_status, '') in ('waiting_worker', 'retrying')
        or (
          coalesce(a.provider_status, '') = 'rtrvr_running'
          and coalesce(a.automation_lease_expires_at, '-infinity'::timestamptz) < now()
        )
      )
      and (
        a.provider_run_output->'queue_parameters'->>'provider' = 'rtrvr'
        or a.automation_provider = 'rtrvr'
      )
    order by a.created_at asc, a.id asc
    limit p_limit
    for update of a skip locked
  ),
  claimed as (
    update public.applications a
    set provider_status = 'rtrvr_running',
        automation_claimed_by = v_worker_id,
        automation_lease_token = gen_random_uuid(),
        automation_lease_expires_at = now() + v_lease,
        automation_heartbeat_at = now(),
        automation_attempt_number = greatest(coalesce(a.automation_attempt_number, 0), 0) + 1,
        updated_at = now()
    from candidates c
    where a.id = c.id
    returning a.id, a.automation_attempt_number, a.automation_lease_token
  )
  select claimed.id, claimed.automation_attempt_number, claimed.automation_lease_token
  from claimed;
end;
$$;

revoke all on function public.claim_next_rtrvr_auto_apply_jobs(integer, text, integer) from public;
grant execute on function public.claim_next_rtrvr_auto_apply_jobs(integer, text, integer) to service_role;

drop function if exists public.renew_rtrvr_auto_apply_job_lease(uuid, text, integer);

create or replace function public.renew_rtrvr_auto_apply_job_lease(
  p_application_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_lease_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease interval := make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 900), 3600)));
  v_updated boolean := false;
begin
  update public.applications
  set automation_heartbeat_at = now(),
      automation_lease_expires_at = now() + v_lease,
      updated_at = now()
  where id = p_application_id
    and canonical_stage = 'queued'
    and automation_provider = 'rtrvr'
    and provider_status = 'rtrvr_running'
    and automation_claimed_by = p_worker_id
    and automation_lease_token = p_lease_token
  returning true into v_updated;

  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.renew_rtrvr_auto_apply_job_lease(uuid, text, uuid, integer) from public;
grant execute on function public.renew_rtrvr_auto_apply_job_lease(uuid, text, uuid, integer) to service_role;

create or replace function public.resume_waiting_rtrvr_auto_apply_job(
  p_application_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean := false;
begin
  update public.applications
  set provider_status = 'waiting_worker',
      failure_reason = null,
      automation_claimed_by = null,
      automation_lease_token = null,
      automation_lease_expires_at = null,
      automation_heartbeat_at = null,
      updated_at = now()
  where id = p_application_id
    and user_id = (select auth.uid())
    and canonical_stage = 'queued'
    and automation_provider = 'rtrvr'
    and provider_status = 'waiting_for_user'
    and automation_idempotency_key is not null
    and (automation_lease_expires_at is null or automation_lease_expires_at < now())
    and coalesce(provider_run_output #>> '{latest_provider_result,result,submitted}', 'false') <> 'true'
  returning true into v_updated;

  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.resume_waiting_rtrvr_auto_apply_job(uuid) from public;
grant execute on function public.resume_waiting_rtrvr_auto_apply_job(uuid) to authenticated;
grant execute on function public.resume_waiting_rtrvr_auto_apply_job(uuid) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.application_automation_attempts;
exception
  when duplicate_object then null;
end $$;
