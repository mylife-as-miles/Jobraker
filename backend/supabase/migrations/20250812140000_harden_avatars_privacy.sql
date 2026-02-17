-- Make avatars bucket private and restrict reads to owner only
update storage.buckets set public = false where id = 'avatars';
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "User scoped read avatars" on storage.objects;
create policy "User scoped read avatars"
  on storage.objects for select
  using (
    bucket_id = 'avatars' and (name like (auth.uid()::text || '/%'))
  );
