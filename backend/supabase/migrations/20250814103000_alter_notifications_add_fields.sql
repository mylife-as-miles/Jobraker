-- Reversioned: Add fields for starred and action URLs on notifications
alter table public.notifications
  add column if not exists is_starred boolean default false,
  add column if not exists action_url text;
-- Helpful indexes
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);
create index if not exists idx_notifications_user_starred on public.notifications(user_id, is_starred);
