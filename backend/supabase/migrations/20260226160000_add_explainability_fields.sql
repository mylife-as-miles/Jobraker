-- Migration to add Explainability fields to the applications table

ALTER TABLE "public"."applications"
ADD COLUMN IF NOT EXISTS "match_reasons" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "receipt_url" TEXT,
ADD COLUMN IF NOT EXISTS "success_url" TEXT;

-- Add comments for maintainability
COMMENT ON COLUMN "public"."applications"."match_reasons" IS 'Array of keywords or skills that overlap between the user profile and job reqs. Explains: "Why this match?"';
COMMENT ON COLUMN "public"."applications"."receipt_url" IS 'URL to an image or PDF of the filled application form. Answers: "What did you send?"';
COMMENT ON COLUMN "public"."applications"."success_url" IS 'URL to a screenshot of the confirmation/success page. Answers: "Did it work?"';
