create table public.cold_mail_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  request_fingerprint text not null
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  recipient_email text not null,
  subject text not null,
  status text not null default 'creating'
    check (status in ('creating', 'created', 'uncertain')),
  provider_draft_id text,
  provider_message_id text,
  provider_thread_id text,
  draft_from text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cold_mail_drafts_user_request_unique
    unique (user_id, request_fingerprint),
  constraint cold_mail_drafts_created_has_provider_id
    check (status <> 'created' or provider_draft_id is not null)
);

create index cold_mail_drafts_user_created_idx
  on public.cold_mail_drafts (user_id, created_at desc);

alter table public.cold_mail_drafts enable row level security;

revoke all on table public.cold_mail_drafts from public, anon, authenticated;
grant all on table public.cold_mail_drafts to service_role;

comment on table public.cold_mail_drafts is
  'Server-owned idempotency ledger for approved Cold Mail Gmail draft writes.';

comment on column public.cold_mail_drafts.request_fingerprint is
  'SHA-256 fingerprint of the signed preparation token; the token itself is never stored.';
