-- Add onboarding completion flag and extended profile fields
alter table public.profiles
  add column if not exists onboarding_complete boolean default false,
  add column if not exists about text,
  add column if not exists education jsonb,
  add column if not exists skills text[] default '{}',
  add column if not exists experience jsonb,
  add column if not exists socials jsonb;

-- Simple GIN index for skills for future search/filter
create index if not exists profiles_skills_idx on public.profiles using gin (skills);

-- Backfill existing rows to false explicitly (nullable default covers new inserts)
update public.profiles set onboarding_complete = coalesce(onboarding_complete, false) where onboarding_complete is null;