create table public.cold_mail_runs (
  agent_run_id uuid primary key
    references public.agent_runs(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  job_id uuid not null
    references public.jobs(id) on delete restrict,
  preset_id text not null default 'recruiter_cold_outreach'
    check (preset_id = 'recruiter_cold_outreach'),
  plan_at_reservation text not null
    check (plan_at_reservation = 'Starter'),
  idempotency_key text not null
    check (char_length(idempotency_key) between 8 and 200),
  status text not null default 'reserved'
    check (status in (
      'reserved',
      'researching',
      'generating',
      'needs_approval',
      'creating_draft',
      'drafted',
      'failed_consumed',
      'uncertain',
      'released'
    )),
  last_stage text not null default 'quota_reserved',
  failure_class text,
  source_policy_version text not null default 'existing_provider_v1',
  quota_consumed_at timestamptz,
  external_work_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cold_mail_runs_user_idempotency_unique
    unique (user_id, idempotency_key)
);

create index cold_mail_runs_user_quota_window_idx
  on public.cold_mail_runs (user_id, quota_consumed_at desc)
  where quota_consumed_at is not null;

alter table public.cold_mail_runs enable row level security;

create policy cold_mail_runs_select_own
  on public.cold_mail_runs
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.cold_mail_runs from public, anon, authenticated;
grant select on table public.cold_mail_runs to authenticated;
grant all on table public.cold_mail_runs to service_role;

comment on table public.cold_mail_runs is
  'Server-owned Starter quota and lifecycle ledger for one-job recruiter cold-mail preset runs.';

alter table public.cold_mail_drafts
  add column cold_mail_run_id uuid
  references public.cold_mail_runs(agent_run_id) on delete set null;

create unique index cold_mail_drafts_run_unique_idx
  on public.cold_mail_drafts (cold_mail_run_id)
  where cold_mail_run_id is not null;

create or replace function public.get_starter_cold_mail_quota_status(
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit constant integer := 20;
  v_used integer := 0;
  v_oldest timestamptz;
begin
  select count(*)::integer, min(run.quota_consumed_at)
    into v_used, v_oldest
  from public.cold_mail_runs as run
  where run.user_id = p_user_id
    and run.quota_consumed_at > now() - interval '24 hours';

  return jsonb_build_object(
    'limit', v_limit,
    'used', v_used,
    'remaining', greatest(v_limit - v_used, 0),
    'window', 'rolling_24_hours',
    'resetAt', case
      when v_oldest is null then null
      else v_oldest + interval '24 hours'
    end
  );
end;
$$;

create or replace function public.reserve_starter_cold_mail_run(
  p_user_id uuid,
  p_job_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit constant integer := 20;
  v_used integer := 0;
  v_agent_run_id uuid;
  v_existing public.cold_mail_runs%rowtype;
  v_quota jsonb;
begin
  if p_user_id is null or p_job_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'cold_mail_invalid_run',
      'error', 'A user and one saved job are required.'
    );
  end if;

  if p_idempotency_key is null or
     char_length(btrim(p_idempotency_key)) not between 8 and 200 then
    return jsonb_build_object(
      'success', false,
      'code', 'cold_mail_invalid_idempotency_key',
      'error', 'A valid Cold Mail run key is required.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select run.*
    into v_existing
  from public.cold_mail_runs as run
  where run.user_id = p_user_id
    and run.idempotency_key = btrim(p_idempotency_key);

  if found then
    v_quota := public.get_starter_cold_mail_quota_status(p_user_id);
    return jsonb_build_object(
      'success', true,
      'agentRunId', v_existing.agent_run_id,
      'status', v_existing.status,
      'idempotentReplay', true,
      'quota', v_quota
    );
  end if;

  if not exists (
    select 1
    from public.jobs as job
    where job.id = p_job_id
      and job.user_id = p_user_id
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'cold_mail_job_not_found',
      'error', 'The selected job was not found in the current saved job search.'
    );
  end if;

  select count(*)::integer
    into v_used
  from public.cold_mail_runs as run
  where run.user_id = p_user_id
    and run.quota_consumed_at > now() - interval '24 hours';

  if v_used >= v_limit then
    return jsonb_build_object(
      'success', false,
      'code', 'cold_mail_daily_limit_reached',
      'error', 'The Starter Cold Mail limit of 20 runs in 24 hours has been reached.',
      'quota', public.get_starter_cold_mail_quota_status(p_user_id)
    );
  end if;

  insert into public.agent_runs (
    user_id,
    run_type,
    status,
    credits_estimated,
    credits_reserved,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    'company_outreach',
    'running',
    0,
    0,
    'cold-mail:' || p_user_id::text || ':' || btrim(p_idempotency_key),
    jsonb_build_object(
      'preset_id', 'recruiter_cold_outreach',
      'plan_at_reservation', 'Starter',
      'job_id', p_job_id
    )
  )
  returning id into v_agent_run_id;

  insert into public.cold_mail_runs (
    agent_run_id,
    user_id,
    job_id,
    plan_at_reservation,
    idempotency_key,
    quota_consumed_at
  ) values (
    v_agent_run_id,
    p_user_id,
    p_job_id,
    'Starter',
    btrim(p_idempotency_key),
    now()
  );

  return jsonb_build_object(
    'success', true,
    'agentRunId', v_agent_run_id,
    'status', 'reserved',
    'idempotentReplay', false,
    'quota', public.get_starter_cold_mail_quota_status(p_user_id)
  );
exception
  when unique_violation then
    select run.*
      into v_existing
    from public.cold_mail_runs as run
    where run.user_id = p_user_id
      and run.idempotency_key = btrim(p_idempotency_key);
    if found then
      return jsonb_build_object(
        'success', true,
        'agentRunId', v_existing.agent_run_id,
        'status', v_existing.status,
        'idempotentReplay', true,
        'quota', public.get_starter_cold_mail_quota_status(p_user_id)
      );
    end if;
    raise;
end;
$$;

create or replace function public.transition_starter_cold_mail_run(
  p_user_id uuid,
  p_agent_run_id uuid,
  p_status text,
  p_last_stage text,
  p_external_work_started boolean default false,
  p_failure_class text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_agent_status text;
  v_updated public.cold_mail_runs%rowtype;
begin
  if p_status not in (
    'reserved', 'researching', 'generating', 'needs_approval',
    'creating_draft', 'drafted', 'failed_consumed', 'uncertain', 'released'
  ) then
    raise exception 'Invalid Cold Mail run status.' using errcode = 'check_violation';
  end if;

  update public.cold_mail_runs as run
  set status = p_status,
      last_stage = coalesce(nullif(btrim(p_last_stage), ''), run.last_stage),
      external_work_started_at = case
        when p_external_work_started then coalesce(run.external_work_started_at, now())
        else run.external_work_started_at
      end,
      failure_class = p_failure_class,
      quota_consumed_at = case
        when p_status = 'released' and run.external_work_started_at is null
          then null
        else run.quota_consumed_at
      end,
      updated_at = now()
  where run.agent_run_id = p_agent_run_id
    and run.user_id = p_user_id
    and not (p_status = 'released' and run.external_work_started_at is not null)
  returning run.* into v_updated;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'cold_mail_run_transition_rejected'
    );
  end if;

  v_agent_status := case
    when p_status = 'drafted' then 'completed'
    when p_status in ('failed_consumed', 'uncertain') then 'failed'
    when p_status = 'released' then 'cancelled'
    else 'running'
  end;

  update public.agent_runs
  set status = v_agent_status,
      failure_reason = p_failure_class,
      last_activity_at = now(),
      updated_at = now()
  where id = p_agent_run_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'agentRunId', v_updated.agent_run_id,
    'status', v_updated.status,
    'quota', public.get_starter_cold_mail_quota_status(p_user_id)
  );
end;
$$;

revoke all on function public.get_starter_cold_mail_quota_status(uuid)
  from public, anon, authenticated;
revoke all on function public.reserve_starter_cold_mail_run(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.transition_starter_cold_mail_run(uuid, uuid, text, text, boolean, text)
  from public, anon, authenticated;

grant execute on function public.get_starter_cold_mail_quota_status(uuid)
  to service_role;
grant execute on function public.reserve_starter_cold_mail_run(uuid, uuid, text)
  to service_role;
grant execute on function public.transition_starter_cold_mail_run(uuid, uuid, text, text, boolean, text)
  to service_role;
