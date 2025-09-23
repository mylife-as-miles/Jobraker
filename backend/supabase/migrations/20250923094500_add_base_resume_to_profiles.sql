-- Add base_resume_id to profiles to mark the user's default/base resume for job search & auto-apply
do $$ begin
  alter table public.profiles
  add column if not exists base_resume_id uuid;
exception when duplicate_column then null; end $$;

-- Add FK to resumes; safe-guard in case it already exists
do $$ begin
  alter table public.profiles
  add constraint profiles_base_resume_fk
  foreign key (base_resume_id) references public.resumes(id)
  on delete set null;
exception when duplicate_object then null; end $$;

-- Optional index to speed up joins/filtering
create index if not exists profiles_base_resume_idx on public.profiles(base_resume_id);
