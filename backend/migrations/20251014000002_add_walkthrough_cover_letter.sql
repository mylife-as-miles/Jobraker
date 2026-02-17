-- Add walkthrough_cover_letter flag to profiles table
-- This tracks whether the user has completed the cover letter builder walkthrough
-- Note: In the code this is referenced as "walkthrough_cover-letter" but stored as "walkthrough_cover_letter"

ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_cover_letter" boolean DEFAULT false;

-- Update the composite index to include the new column
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
  (not walkthrough_chat),
  (not walkthrough_cover_letter)
);

COMMENT ON COLUMN "public"."profiles"."walkthrough_cover_letter" IS 'Indicates whether the user has completed the cover letter builder walkthrough';
