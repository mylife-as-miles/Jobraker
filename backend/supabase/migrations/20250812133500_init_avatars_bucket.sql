-- Migration: create avatars bucket and storage object policies
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
-- Reset policies if they exist, then create
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "User scoped write avatars" on storage.objects;
drop policy if exists "User scoped update avatars" on storage.objects;
drop policy if exists "User scoped delete avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
create policy "User scoped write avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (name like (auth.uid()::text || '/%'))
  );
create policy "User scoped update avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and (name like (auth.uid()::text || '/%'))
  )
  with check (
    bucket_id = 'avatars' and (name like (auth.uid()::text || '/%'))
  );
create policy "User scoped delete avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and (name like (auth.uid()::text || '/%'))
  );
