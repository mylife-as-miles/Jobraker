-- Add retry_count column to applications table
ALTER TABLE "public"."applications"
ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0;
