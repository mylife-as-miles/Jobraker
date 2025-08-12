-- Notifications table for per-user dashboard notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('interview','application','system','company')),
  title text not null,
  message text,
  company text,
  read boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_notifications_user_id_created_at on public.notifications(user_id, created_at desc);

-- RLS
alter table public.notifications enable row level security;

-- Drop old policies if they exist to avoid duplicates on re-run
drop policy if exists "Read own notifications" on public.notifications;
 drop policy if exists "Insert own notifications" on public.notifications;
 drop policy if exists "Update own notifications" on public.notifications;
 drop policy if exists "Delete own notifications" on public.notifications;

create policy "Read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Insert own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

create policy "Update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.notifications;
