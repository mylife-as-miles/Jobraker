-- Enable realtime for profile collections tables
-- Guards against duplicate additions by checking pg_publication_tables

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_experiences'
  ) then
    execute 'alter publication supabase_realtime add table public.profile_experiences';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_education'
  ) then
    execute 'alter publication supabase_realtime add table public.profile_education';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_skills'
  ) then
    execute 'alter publication supabase_realtime add table public.profile_skills';
  end if;
end $$;
