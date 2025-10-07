-- Comprehensive migration to rename the user_jobs table to jobs
-- and update all dependent database objects for clarity and consistency.

-- Step 1: Rename the table.
ALTER TABLE "public"."user_jobs" RENAME TO "jobs";

-- Step 2: Rename the primary key constraint.
ALTER INDEX "user_jobs_pkey" RENAME TO "jobs_pkey";

-- Step 3: Rename all associated indexes.
ALTER INDEX "idx_user_jobs_unique_per_user" RENAME TO "idx_jobs_unique_per_user";
ALTER INDEX "idx_user_jobs_user_id" RENAME TO "idx_jobs_user_id";
ALTER INDEX "idx_user_jobs_status" RENAME TO "idx_jobs_status";
ALTER INDEX "idx_user_jobs_source_type" RENAME TO "idx_jobs_source_type";
ALTER INDEX "idx_user_jobs_posted_at" RENAME TO "idx_jobs_posted_at";
ALTER INDEX "idx_user_jobs_bookmarked" RENAME TO "idx_jobs_bookmarked";
ALTER INDEX "idx_user_jobs_search_text" RENAME TO "idx_jobs_search_text";

-- Step 4: Rename the foreign key constraint.
ALTER TABLE "public"."jobs" RENAME CONSTRAINT "user_jobs_user_id_fkey" TO "jobs_user_id_fkey";

-- Step 5: Rename the check constraint.
ALTER TABLE "public"."jobs" RENAME CONSTRAINT "user_jobs_rating_check" TO "jobs_rating_check";

-- Step 6: Rename the Row Level Security policies for clarity.
ALTER POLICY "Users can view their own jobs" ON "public"."jobs" RENAME TO "select_own_jobs";
ALTER POLICY "Users can insert their own jobs" ON "public"."jobs" RENAME TO "insert_own_jobs";
ALTER POLICY "Users can update their own jobs" ON "public"."jobs" RENAME TO "update_own_jobs";
ALTER POLICY "Users can delete their own jobs" ON "public"."jobs" RENAME TO "delete_own_jobs";

-- Step 7: Rename the trigger.
ALTER TRIGGER "update_user_jobs_updated_at" ON "public"."jobs" RENAME TO "handle_updated_at";

-- Step 8: Drop the old dependent view and create a new one with a new name.
DROP VIEW IF EXISTS "public"."user_job_stats";
CREATE OR REPLACE VIEW "public"."job_stats" AS
 SELECT "user_id",
    "count"(*) AS "total_jobs",
    "count"(*) FILTER (WHERE ("status" = 'active'::"text")) AS "active_jobs",
    "count"(*) FILTER (WHERE ("status" = 'applied'::"text")) AS "applied_jobs",
    "count"(*) FILTER (WHERE ("status" = 'interview'::"text")) AS "interview_jobs",
    "count"(*) FILTER (WHERE ("status" = 'offer'::"text")) AS "offer_jobs",
    "count"(*) FILTER (WHERE ("bookmarked" = true)) AS "bookmarked_jobs",
    "count"(*) FILTER (WHERE ("created_at" >= ("now"() - '7 days'::interval))) AS "jobs_this_week",
    "count"(*) FILTER (WHERE ("created_at" >= ("now"() - '30 days'::interval))) AS "jobs_this_month"
   FROM "public"."jobs"
  GROUP BY "user_id";

-- Grant permissions on the new view
GRANT ALL ON TABLE "public"."job_stats" TO "anon";
GRANT ALL ON TABLE "public"."job_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."job_stats" TO "service_role";