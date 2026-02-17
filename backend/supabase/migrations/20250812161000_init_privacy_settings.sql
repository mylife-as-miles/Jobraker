-- Privacy settings per user
create table if not exists public.privacy_settings (
	id uuid primary key references auth.users(id) on delete cascade,
	is_profile_public boolean default false,
	show_email boolean default false,
	allow_search_indexing boolean default false,
	share_analytics boolean default false,
	personalized_ads boolean default false,
	resume_default_public boolean default false,
	updated_at timestamptz default now()
);
alter table public.privacy_settings enable row level security;
drop policy if exists "Read own privacy" on public.privacy_settings;
drop policy if exists "Insert own privacy" on public.privacy_settings;
drop policy if exists "Update own privacy" on public.privacy_settings;
drop policy if exists "Delete own privacy" on public.privacy_settings;
create policy "Read own privacy"
	on public.privacy_settings for select using (auth.uid() = id);
create policy "Insert own privacy"
	on public.privacy_settings for insert with check (auth.uid() = id);
create policy "Update own privacy"
	on public.privacy_settings for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Delete own privacy"
	on public.privacy_settings for delete using (auth.uid() = id);
-- Realtime
alter publication supabase_realtime add table public.privacy_settings;
