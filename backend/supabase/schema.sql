-- Profiles table to store onboarding info
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

-- RLS Policies
alter table public.profiles enable row level security;

-- Allow users to read their own profile
create policy if not exists "Read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Allow users to insert their own profile
create policy if not exists "Insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Allow users to update their own profile
create policy if not exists "Update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
