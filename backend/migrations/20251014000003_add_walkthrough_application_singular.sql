-- Add walkthrough_application (singular) to fix mismatch with ApplicationPage
-- ApplicationPage uses page: 'application' which generates 'walkthrough_application'
-- But the original migration only added 'walkthrough_applications' (plural)

ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_application" boolean DEFAULT false;

-- Update the composite index to include the new column
DROP INDEX IF EXISTS "profiles_walkthrough_incomplete_idx";

CREATE INDEX IF NOT EXISTS "profiles_walkthrough_incomplete_idx" ON "public"."profiles" USING btree (
  (not walkthrough_overview),
  (not walkthrough_application),   -- Singular (new)
  (not walkthrough_applications),  -- Plural (legacy, kept for backwards compatibility)
  (not walkthrough_jobs),
  (not walkthrough_resume),
  (not walkthrough_analytics),
  (not walkthrough_settings),
  (not walkthrough_profile),
  (not walkthrough_notifications),
  (not walkthrough_chat),
  (not walkthrough_cover_letter)
);

COMMENT ON COLUMN "public"."profiles"."walkthrough_application" IS 'Indicates whether the user has completed the application page walkthrough (singular form to match page ID)';
