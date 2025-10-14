-- Quick fix for missing walkthrough columns
-- Run this in Supabase Dashboard → SQL Editor

-- Add walkthrough_chat column
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_chat" boolean DEFAULT false;

-- Add walkthrough_cover_letter column (note: using underscore in database, hyphen in code)
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_cover_letter" boolean DEFAULT false;

-- Add walkthrough_application column (singular) to fix ApplicationPage mismatch
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_application" boolean DEFAULT false;

-- Recreate the composite index with all walkthrough columns
DROP INDEX IF EXISTS "profiles_walkthrough_incomplete_idx";

CREATE INDEX IF NOT EXISTS "profiles_walkthrough_incomplete_idx" ON "public"."profiles" USING btree (
  (not walkthrough_overview),
  (not walkthrough_application),   -- Singular (for ApplicationPage)
  (not walkthrough_applications),  -- Plural (legacy)
  (not walkthrough_jobs),
  (not walkthrough_resume),
  (not walkthrough_analytics),
  (not walkthrough_settings),
  (not walkthrough_profile),
  (not walkthrough_notifications),
  (not walkthrough_chat),
  (not walkthrough_cover_letter)
);
