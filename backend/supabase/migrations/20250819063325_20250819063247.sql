drop policy "Insert own appearance" on "public"."appearance_settings";

drop policy "Read own appearance" on "public"."appearance_settings";

drop policy "Update own appearance" on "public"."appearance_settings";

drop policy "Delete own notifications" on "public"."notifications";

drop policy "Insert own notifications" on "public"."notifications";

drop policy "Read own notifications" on "public"."notifications";

drop policy "Update own notifications" on "public"."notifications";

drop policy "Delete own privacy" on "public"."privacy_settings";

drop policy "Insert own privacy" on "public"."privacy_settings";

drop policy "Read own privacy" on "public"."privacy_settings";

drop policy "Update own privacy" on "public"."privacy_settings";

revoke delete on table "public"."appearance_settings" from "anon";

revoke insert on table "public"."appearance_settings" from "anon";

revoke references on table "public"."appearance_settings" from "anon";

revoke select on table "public"."appearance_settings" from "anon";

revoke trigger on table "public"."appearance_settings" from "anon";

revoke truncate on table "public"."appearance_settings" from "anon";

revoke update on table "public"."appearance_settings" from "anon";

revoke delete on table "public"."appearance_settings" from "authenticated";

revoke insert on table "public"."appearance_settings" from "authenticated";

revoke references on table "public"."appearance_settings" from "authenticated";

revoke select on table "public"."appearance_settings" from "authenticated";

revoke trigger on table "public"."appearance_settings" from "authenticated";

revoke truncate on table "public"."appearance_settings" from "authenticated";

revoke update on table "public"."appearance_settings" from "authenticated";

revoke delete on table "public"."appearance_settings" from "service_role";

revoke insert on table "public"."appearance_settings" from "service_role";

revoke references on table "public"."appearance_settings" from "service_role";

revoke select on table "public"."appearance_settings" from "service_role";

revoke trigger on table "public"."appearance_settings" from "service_role";

revoke truncate on table "public"."appearance_settings" from "service_role";

revoke update on table "public"."appearance_settings" from "service_role";

revoke delete on table "public"."notifications" from "anon";

revoke insert on table "public"."notifications" from "anon";

revoke references on table "public"."notifications" from "anon";

revoke select on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke update on table "public"."notifications" from "anon";

revoke delete on table "public"."notifications" from "authenticated";

revoke insert on table "public"."notifications" from "authenticated";

revoke references on table "public"."notifications" from "authenticated";

revoke select on table "public"."notifications" from "authenticated";

revoke trigger on table "public"."notifications" from "authenticated";

revoke truncate on table "public"."notifications" from "authenticated";

revoke update on table "public"."notifications" from "authenticated";

revoke delete on table "public"."notifications" from "service_role";

revoke insert on table "public"."notifications" from "service_role";

revoke references on table "public"."notifications" from "service_role";

revoke select on table "public"."notifications" from "service_role";

revoke trigger on table "public"."notifications" from "service_role";

revoke truncate on table "public"."notifications" from "service_role";

revoke update on table "public"."notifications" from "service_role";

revoke delete on table "public"."privacy_settings" from "anon";

revoke insert on table "public"."privacy_settings" from "anon";

revoke references on table "public"."privacy_settings" from "anon";

revoke select on table "public"."privacy_settings" from "anon";

revoke trigger on table "public"."privacy_settings" from "anon";

revoke truncate on table "public"."privacy_settings" from "anon";

revoke update on table "public"."privacy_settings" from "anon";

revoke delete on table "public"."privacy_settings" from "authenticated";

revoke insert on table "public"."privacy_settings" from "authenticated";

revoke references on table "public"."privacy_settings" from "authenticated";

revoke select on table "public"."privacy_settings" from "authenticated";

revoke trigger on table "public"."privacy_settings" from "authenticated";

revoke truncate on table "public"."privacy_settings" from "authenticated";

revoke update on table "public"."privacy_settings" from "authenticated";

revoke delete on table "public"."privacy_settings" from "service_role";

revoke insert on table "public"."privacy_settings" from "service_role";

revoke references on table "public"."privacy_settings" from "service_role";

revoke select on table "public"."privacy_settings" from "service_role";

revoke trigger on table "public"."privacy_settings" from "service_role";

revoke truncate on table "public"."privacy_settings" from "service_role";

revoke update on table "public"."privacy_settings" from "service_role";

alter table "public"."appearance_settings" drop constraint "appearance_settings_id_fkey";

alter table "public"."appearance_settings" drop constraint "appearance_settings_theme_check";

alter table "public"."notifications" drop constraint "notifications_type_check";

alter table "public"."notifications" drop constraint "notifications_user_id_fkey";

alter table "public"."privacy_settings" drop constraint "privacy_settings_id_fkey";

alter table "public"."appearance_settings" drop constraint "appearance_settings_pkey";

alter table "public"."notifications" drop constraint "notifications_pkey";

alter table "public"."privacy_settings" drop constraint "privacy_settings_pkey";

drop index if exists "public"."appearance_settings_pkey";

drop index if exists "public"."idx_notifications_user_id_created_at";

drop index if exists "public"."idx_notifications_user_read";

drop index if exists "public"."idx_notifications_user_starred";

drop index if exists "public"."notifications_pkey";

drop index if exists "public"."privacy_settings_pkey";

drop table "public"."appearance_settings";

drop table "public"."notifications";

drop table "public"."privacy_settings";

create table "public"."applications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "job_title" text not null,
    "company" text not null,
    "location" text default ''::text,
    "applied_date" timestamp with time zone not null default now(),
    "status" text not null default 'Applied'::text,
    "salary" text,
    "notes" text,
    "next_step" text,
    "interview_date" timestamp with time zone,
    "logo" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."applications" enable row level security;

CREATE UNIQUE INDEX applications_pkey ON public.applications USING btree (id);

CREATE INDEX applications_user_updated_idx ON public.applications USING btree (user_id, updated_at DESC);

alter table "public"."applications" add constraint "applications_pkey" PRIMARY KEY using index "applications_pkey";

alter table "public"."applications" add constraint "applications_status_check" CHECK ((status = ANY (ARRAY['Applied'::text, 'Interview'::text, 'Offer'::text, 'Rejected'::text, 'Withdrawn'::text]))) not valid;

alter table "public"."applications" validate constraint "applications_status_check";

alter table "public"."applications" add constraint "applications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."applications" validate constraint "applications_user_id_fkey";

grant delete on table "public"."applications" to "anon";

grant insert on table "public"."applications" to "anon";

grant references on table "public"."applications" to "anon";

grant select on table "public"."applications" to "anon";

grant trigger on table "public"."applications" to "anon";

grant truncate on table "public"."applications" to "anon";

grant update on table "public"."applications" to "anon";

grant delete on table "public"."applications" to "authenticated";

grant insert on table "public"."applications" to "authenticated";

grant references on table "public"."applications" to "authenticated";

grant select on table "public"."applications" to "authenticated";

grant trigger on table "public"."applications" to "authenticated";

grant truncate on table "public"."applications" to "authenticated";

grant update on table "public"."applications" to "authenticated";

grant delete on table "public"."applications" to "service_role";

grant insert on table "public"."applications" to "service_role";

grant references on table "public"."applications" to "service_role";

grant select on table "public"."applications" to "service_role";

grant trigger on table "public"."applications" to "service_role";

grant truncate on table "public"."applications" to "service_role";

grant update on table "public"."applications" to "service_role";

create policy "Delete own applications"
on "public"."applications"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Insert own applications"
on "public"."applications"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Select own applications"
on "public"."applications"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Update own applications"
on "public"."applications"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



