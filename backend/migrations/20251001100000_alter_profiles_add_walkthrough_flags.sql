-- Add dashboard walkthrough flags (per major section)
alter table public.profiles
  add column if not exists walkthrough_overview boolean default false,
  add column if not exists walkthrough_applications boolean default false,
  add column if not exists walkthrough_jobs boolean default false,
  add column if not exists walkthrough_resume boolean default false,
  add column if not exists walkthrough_analytics boolean default false,
  add column if not exists walkthrough_settings boolean default false,
  add column if not exists walkthrough_profile boolean default false,
  add column if not exists walkthrough_notifications boolean default false;

-- Composite convenience index for quick filter of any not-finished walkthrough users (rare query, but helpful)
create index if not exists profiles_walkthrough_incomplete_idx on public.profiles using btree (
  (not walkthrough_overview) ,
  (not walkthrough_applications) ,
  (not walkthrough_jobs) ,
  (not walkthrough_resume) ,
  (not walkthrough_analytics) ,
  (not walkthrough_settings) ,
  (not walkthrough_profile) ,
  (not walkthrough_notifications)
);
