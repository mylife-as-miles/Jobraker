-- Appearance settings per user
create table if not exists public.appearance_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  theme text check (theme in ('dark','light','auto')) default 'auto',
  accent_color text default '#1dff00',
  reduce_motion boolean default false,
  updated_at timestamptz default now()
);

alter table public.appearance_settings enable row level security;

create policy if not exists "Read own appearance"
  on public.appearance_settings for select
  using (auth.uid() = id);

create policy if not exists "Insert own appearance"
  on public.appearance_settings for insert
  with check (auth.uid() = id);

create policy if not exists "Update own appearance"
  on public.appearance_settings for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Enable realtime
alter publication supabase_realtime add table public.appearance_settings;
