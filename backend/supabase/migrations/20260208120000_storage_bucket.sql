
-- Create a storage bucket for chat attachments
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- Set up security policies for the bucket
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'chat-attachments' );

create policy "Authenticated Users can Upload"
on storage.objects for insert
with check ( bucket_id = 'chat-attachments' and auth.role() = 'authenticated' );
