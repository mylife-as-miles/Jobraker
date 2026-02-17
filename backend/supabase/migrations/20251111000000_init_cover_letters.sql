-- Create cover_letters table and RLS policies
create table if not exists "public"."cover_letters" (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "name" text not null default 'Untitled Cover Letter',
  "role" text,
  "company" text,
  "job_description" text,
  "tone" text default 'professional',
  "length_pref" text default 'medium',
  "sender_name" text,
  "sender_email" text,
  "sender_phone" text,
  "sender_address" text,
  "recipient" text,
  "recipient_title" text,
  "recipient_address" text,
  "date" text,
  "subject" text,
  "salutation" text default 'Dear Hiring Manager,',
  "paragraphs" jsonb default '[]'::jsonb,
  "closing" text default 'Best regards,',
  "signature_name" text,
  "content" text,
  "font_size" integer default 16,
  "is_default" boolean default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint cover_letters_pkey primary key ("id")
);

alter table "public"."cover_letters"
  add constraint cover_letters_user_id_fkey foreign key ("user_id") references auth.users(id) on delete cascade;

create index if not exists cover_letters_user_updated_idx on "public"."cover_letters" using btree ("user_id", "updated_at" desc);
create index if not exists cover_letters_user_default_idx on "public"."cover_letters" using btree ("user_id", "is_default") where "is_default" = true;

alter table "public"."cover_letters" enable row level security;

-- Policies
create policy "Select own cover letters" on "public"."cover_letters" for select using ((auth.uid() = user_id));
create policy "Insert own cover letters" on "public"."cover_letters" for insert with check ((auth.uid() = user_id));
create policy "Update own cover letters" on "public"."cover_letters" for update using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Delete own cover letters" on "public"."cover_letters" for delete using ((auth.uid() = user_id));

-- Grants
grant all on table "public"."cover_letters" to "anon";
grant all on table "public"."cover_letters" to "authenticated";
grant all on table "public"."cover_letters" to "service_role";

-- Function to ensure only one default per user
create or replace function ensure_single_default_cover_letter()
returns trigger as $$
begin
  if new.is_default = true then
    update public.cover_letters
    set is_default = false
    where user_id = new.user_id
      and id != new.id
      and is_default = true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger ensure_single_default_cover_letter_trigger
  before insert or update on public.cover_letters
  for each row
  execute function ensure_single_default_cover_letter();

