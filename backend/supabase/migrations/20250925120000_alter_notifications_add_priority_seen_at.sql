-- Add priority and seen_at columns to notifications
alter table public.notifications
  add column if not exists priority text check (priority in ('low','medium','high')) default 'medium',
  add column if not exists seen_at timestamptz;

-- Index to help filter unread/high-priority quickly
create index if not exists idx_notifications_user_priority on public.notifications(user_id, priority);
create index if not exists idx_notifications_user_unseen on public.notifications(user_id) where seen_at is null;

-- Comments
comment on column public.notifications.priority is 'Relative importance of the notification';
comment on column public.notifications.seen_at is 'Timestamp when user viewed notification detail pane';
