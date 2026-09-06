alter table public.privacy_settings
  add column if not exists cookie_consent_status text,
  add column if not exists cookie_consent_version text,
  add column if not exists cookie_consent_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'privacy_settings_cookie_consent_status_check'
      and conrelid = 'public.privacy_settings'::regclass
  ) then
    alter table public.privacy_settings
      add constraint privacy_settings_cookie_consent_status_check
      check (cookie_consent_status in ('accepted', 'essential_only'));
  end if;
end
$$;

comment on column public.privacy_settings.cookie_consent_status is
  'Latest explicit cookie choice: accepted or essential_only; null means no current choice.';
comment on column public.privacy_settings.cookie_consent_version is
  'Cookie policy version shown when the user made the choice.';
comment on column public.privacy_settings.cookie_consent_updated_at is
  'Timestamp of the latest explicit cookie choice.';
