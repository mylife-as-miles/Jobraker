-- Initial profiles schema and RLS policies
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  job_title text,
  experience_years int,
  location text,
  goals text[] default '{}',
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Read own profile"
  on public.profiles for select
  using (auth.uid() = id);
create policy "Insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
create policy "Update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
