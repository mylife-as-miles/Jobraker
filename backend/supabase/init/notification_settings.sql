-- Notification settings table for each user
create table if not exists public.notification_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  email_notifications boolean default true,
  push_notifications boolean default true,
  job_alerts boolean default true,
  application_updates boolean default true,
  weekly_digest boolean default false,
  marketing_emails boolean default false,
  updated_at timestamptz default now()
);

-- RLS Policies
alter table public.notification_settings enable row level security;


create policy "Read own notification settings"
  on public.notification_settings for select
  using (auth.uid() = id);


create policy "Insert own notification settings"
  on public.notification_settings for insert
  with check (auth.uid() = id);


create policy "Update own notification settings"
  on public.notification_settings for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


create policy "Delete own notification settings"
  on public.notification_settings for delete
  using (auth.uid() = id);
