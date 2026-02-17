-- Add company_logo column to jobs table for storing company logo URLs
ALTER TABLE "public"."jobs" 
ADD COLUMN IF NOT EXISTS "company_logo" "text";

-- Create index on company_logo for faster queries
CREATE INDEX IF NOT EXISTS "jobs_company_logo_idx" ON "public"."jobs" USING btree ("company_logo");

COMMENT ON COLUMN "public"."jobs"."company_logo" IS 'URL to the company logo image';
