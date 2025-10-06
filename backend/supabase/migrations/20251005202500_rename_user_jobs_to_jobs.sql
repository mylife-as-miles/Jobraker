-- Rename the user_jobs table to jobs for clarity and to align with the new personalized job queue feature.

-- Step 1: Rename the table itself.
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
-- Note: The constraint name might vary. If this fails, it will need to be looked up and adjusted.
ALTER TABLE "public"."jobs" RENAME CONSTRAINT "user_jobs_user_id_fkey" TO "jobs_user_id_fkey";

-- Step 5: Rename the check constraint.
ALTER TABLE "public"."jobs" RENAME CONSTRAINT "user_jobs_rating_check" TO "jobs_rating_check";

-- Step 6: Rename the Row Level Security policies.
ALTER POLICY "Users can view their own jobs" ON "public"."jobs" RENAME TO "jobs_select_own";
ALTER POLICY "Users can insert their own jobs" ON "public"."jobs" RENAME TO "jobs_insert_own";
ALTER POLICY "Users can update their own jobs" ON "public"."jobs" RENAME TO "jobs_update_own";
ALTER POLICY "Users can delete their own jobs" ON "public"."jobs" RENAME TO "jobs_delete_own";

-- Step 7: Rename the trigger for updating the updated_at column.
ALTER TRIGGER "update_user_jobs_updated_at" ON "public"."jobs" RENAME TO "update_jobs_updated_at";

-- Step 8: Recreate the dependent view with the new table name.
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