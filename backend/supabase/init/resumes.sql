-- Resumes storage bucket
insert into storage.buckets (id, name, public)
select 'resumes', 'resumes', false
where not exists (select 1 from storage.buckets where id = 'resumes');

-- Resumes table
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  template text,
  status text not null default 'Draft' check (status in ('Active','Draft','Archived')),
  applications int not null default 0,
  thumbnail text,
  is_favorite boolean not null default false,
  file_path text,
  file_ext text,
  size bigint,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.resumes enable row level security;

create policy if not exists "Select own resumes"
  on public.resumes for select
  using (auth.uid() = user_id);

create policy if not exists "Insert own resumes"
  on public.resumes for insert
  with check (auth.uid() = user_id);

create policy if not exists "Update own resumes"
  on public.resumes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Delete own resumes"
  on public.resumes for delete
  using (auth.uid() = user_id);

-- Helpful index
create index if not exists resumes_user_updated_idx on public.resumes(user_id, updated_at desc);

-- Storage policies for bucket resumes
create policy if not exists "Users can manage own resume files"
  on storage.objects for all
  using (
    bucket_id = 'resumes' and (auth.uid()::text = (string_to_array(name, '/'))[1])
  )
  with check (
    bucket_id = 'resumes' and (auth.uid()::text = (string_to_array(name, '/'))[1])
  );
