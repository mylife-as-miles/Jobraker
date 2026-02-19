-- Add onboarding_complete and extended profile enrichment fields (mirrors local backend/migrations addition)
alter table if exists public.profiles add column if not exists onboarding_complete boolean default false;
alter table if exists public.profiles add column if not exists about text;
alter table if exists public.profiles add column if not exists education jsonb;
alter table if exists public.profiles add column if not exists skills text[] default '{}';
alter table if exists public.profiles add column if not exists experience jsonb;
alter table if exists public.profiles add column if not exists socials jsonb;

create index if not exists profiles_skills_idx on public.profiles using gin (skills);

update public.profiles set onboarding_complete = coalesce(onboarding_complete,false) where onboarding_complete is null;
