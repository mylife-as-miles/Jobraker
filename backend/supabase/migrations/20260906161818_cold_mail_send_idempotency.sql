alter table public.cold_mail_drafts
  add column if not exists sent_at timestamptz;

alter table public.cold_mail_drafts
  drop constraint if exists cold_mail_drafts_status_check;

alter table public.cold_mail_drafts
  add constraint cold_mail_drafts_status_check
  check (status in (
    'creating',
    'created',
    'uncertain',
    'sending',
    'sent',
    'send_uncertain'
  ));

alter table public.cold_mail_drafts
  drop constraint if exists cold_mail_drafts_created_has_provider_id;

alter table public.cold_mail_drafts
  add constraint cold_mail_drafts_provider_draft_required
  check (
    status not in ('created', 'sending', 'sent', 'send_uncertain')
    or provider_draft_id is not null
  );

alter table public.cold_mail_drafts
  add constraint cold_mail_drafts_sent_has_message_id
  check (status <> 'sent' or provider_message_id is not null);

create unique index if not exists cold_mail_drafts_user_provider_draft_unique
  on public.cold_mail_drafts (user_id, provider_draft_id)
  where provider_draft_id is not null;

comment on column public.cold_mail_drafts.sent_at is
  'Timestamp recorded only after Gmail confirms delivery with a provider message ID.';
