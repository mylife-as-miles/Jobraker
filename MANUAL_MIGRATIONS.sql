-- Quick fix for missing walkthrough_chat column
-- Run this in Supabase Dashboard → SQL Editor

-- Add walkthrough_chat column
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_chat" boolean DEFAULT false;

-- Recreate the composite index with the new column
DROP INDEX IF EXISTS "profiles_walkthrough_incomplete_idx";

CREATE INDEX IF NOT EXISTS "profiles_walkthrough_incomplete_idx" ON "public"."profiles" USING btree (
  (not walkthrough_overview),
  (not walkthrough_applications),
  (not walkthrough_jobs),
  (not walkthrough_resume),
  (not walkthrough_analytics),
  (not walkthrough_settings),
  (not walkthrough_profile),
  (not walkthrough_notifications),
  (not walkthrough_chat)
);
