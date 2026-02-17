-- Ensure UUID generator exists
create extension if not exists pgcrypto;
-- Create table and indexes idempotently
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'job_listings'
  ) then
    create table public.job_listings (
      id uuid default gen_random_uuid() primary key,
      job_title text not null,
      company_name text not null,
      location text,
      work_type text,
      experience_level text,
      required_skills text[] default '{}'::text[],
      full_job_description text not null,
      description_embedding double precision[],
      source_url text not null,
      source text,
      external_id text,
      posted_at timestamptz,
      tags text[],
      salary_min integer,
      salary_max integer,
      created_at timestamptz default now() not null,
      updated_at timestamptz default now() not null
    );
    create unique index job_listings_source_url_key on public.job_listings (source_url);
    create index job_listings_title_company_idx on public.job_listings (job_title, company_name);
    create index job_listings_location_idx on public.job_listings (location);
    create index job_listings_posted_at_idx on public.job_listings (posted_at desc);
  end if;
end $$;
-- RLS + read policy
alter table public.job_listings enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_listings'
      and policyname = 'Read job listings'
  ) then
    create policy "Read job listings" on public.job_listings
      for select using (true);
  end if;
end $$;
-- Grants
grant select on table public.job_listings to anon, authenticated;
grant all on table public.job_listings to service_role;
