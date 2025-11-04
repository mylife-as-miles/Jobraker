-- Migration: Create a trigger to insert notification_settings for new users
-- This function is called by the trigger below
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.notification_settings (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- This trigger calls the function above after a new user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill notification_settings for existing users who are missing them
insert into public.notification_settings (id)
select id from auth.users where id not in (select id from public.notification_settings);
