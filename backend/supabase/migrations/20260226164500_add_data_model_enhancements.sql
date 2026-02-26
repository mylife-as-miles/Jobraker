-- Migration to add Data Model Enhancements (Draft Status, Confidence Score, User Notes, Hidden Jobs)

-- Applications Table Enhancements
ALTER TABLE "public"."applications"
ADD COLUMN IF NOT EXISTS "draft_status" TEXT DEFAULT 'ready'::text,
ADD COLUMN IF NOT EXISTS "ai_confidence_score" INTEGER,
ADD COLUMN IF NOT EXISTS "user_review_notes" TEXT;

ALTER TABLE "public"."applications"
DROP CONSTRAINT IF EXISTS applications_draft_status_check;

ALTER TABLE "public"."applications"
ADD CONSTRAINT applications_draft_status_check
CHECK (draft_status IN ('draft', 'ready', 'sent'));

COMMENT ON COLUMN "public"."applications"."draft_status" IS 'Tracks the preparation state: draft, ready, or sent.';
COMMENT ON COLUMN "public"."applications"."ai_confidence_score" IS '0-100 score indicating AI confidence in the match safety for auto applying.';
COMMENT ON COLUMN "public"."applications"."user_review_notes" IS 'Explicit notes explicitly written by the user reviewing the application (as opposed to automated generic notes).';

-- Jobs Table Enhancements
ALTER TABLE "public"."jobs"
ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN DEFAULT false;

COMMENT ON COLUMN "public"."jobs"."hidden" IS 'Boolean flag to hide low-quality matches from the user interface.';
