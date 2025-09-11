-- Create applications tracking table and RLS policies
create table if not exists "public"."applications" (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "job_title" text not null,
  "company" text not null,
  "location" text default ''::text,
  "applied_date" timestamptz not null default now(),
  "status" text not null default 'Applied'::text,
  "salary" text,
  "notes" text,
  "next_step" text,
  "interview_date" timestamptz,
  "logo" text,
  -- Skyvern tracking fields
  "run_id" text,
  "workflow_id" text,
  "app_url" text,
  "provider_status" text,
  "recording_url" text,
  "failure_reason" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint applications_pkey primary key ("id"),
  constraint applications_status_check check (status in ('Pending','Applied','Interview','Offer','Rejected','Withdrawn'))
);

alter table "public"."applications"
  add constraint applications_user_id_fkey foreign key ("user_id") references auth.users(id) on delete cascade;

create index if not exists applications_user_updated_idx on "public"."applications" using btree ("user_id", "updated_at" desc);

alter table "public"."applications" enable row level security;

-- Policies
create policy "Select own applications" on "public"."applications" for select using ((auth.uid() = user_id));
create policy "Insert own applications" on "public"."applications" for insert with check ((auth.uid() = user_id));
create policy "Update own applications" on "public"."applications" for update using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Delete own applications" on "public"."applications" for delete using ((auth.uid() = user_id));

-- Grants
grant all on table "public"."applications" to "anon";
grant all on table "public"."applications" to "authenticated";
grant all on table "public"."applications" to "service_role";
