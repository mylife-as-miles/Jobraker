-- Add walkthrough_chat flag to profiles table
-- This tracks whether the user has completed the chat/AI assistant walkthrough

ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_chat" boolean DEFAULT false;

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
  (not walkthrough_chat)
);

COMMENT ON COLUMN "public"."profiles"."walkthrough_chat" IS 'Indicates whether the user has completed the chat/AI assistant walkthrough';
