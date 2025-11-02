-- Create jobs table (if not exists) with all required fields for AI-enhanced job search
-- This table stores job listings discovered via Firecrawl with AI-extracted data

CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "source_type" "text" NOT NULL,
    "source_id" "text",
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "remote_type" "text",
    "employment_type" "text",
    "salary_min" integer,
    "salary_max" integer,
    "salary_currency" "text" DEFAULT 'USD'::"text",
    "experience_level" "text",
    "tags" "text"[],
    "apply_url" "text",
    "posted_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "notes" "text",
    "rating" integer,
    "bookmarked" boolean DEFAULT false,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "jobs_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);

-- Create unique constraint on user_id and source_id
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_user_source_unique" ON "public"."jobs" USING btree ("user_id", "source_id");

-- Enable RLS
ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY IF NOT EXISTS "Users can view their own jobs" ON "public"."jobs"
    FOR SELECT USING ("auth"."uid"() = "user_id");

CREATE POLICY IF NOT EXISTS "Users can insert their own jobs" ON "public"."jobs"
    FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");

CREATE POLICY IF NOT EXISTS "Users can update their own jobs" ON "public"."jobs"
    FOR UPDATE USING ("auth"."uid"() = "user_id");

CREATE POLICY IF NOT EXISTS "Users can delete their own jobs" ON "public"."jobs"
    FOR DELETE USING ("auth"."uid"() = "user_id");

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS "set_jobs_updated_at" ON "public"."jobs";
CREATE TRIGGER "set_jobs_updated_at"
    BEFORE UPDATE ON "public"."jobs"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_updated_at"();

-- Grant permissions
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS "jobs_user_id_idx" ON "public"."jobs" USING btree ("user_id");

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "public"."jobs" USING btree ("status");

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS "jobs_created_at_idx" ON "public"."jobs" USING btree ("created_at" DESC);
-- Add company_logo column to jobs table for storing company logo URLs
ALTER TABLE "public"."jobs"
ADD COLUMN IF NOT EXISTS "company_logo" "text";

-- Create index on company_logo for faster queries
CREATE INDEX IF NOT EXISTS "jobs_company_logo_idx" ON "public"."jobs" USING btree ("company_logo");

COMMENT ON COLUMN "public"."jobs"."company_logo" IS 'URL to the company logo image';
-- This migration creates the user_streaks table, a function to update the streak, and a trigger to call the function.

-- Create user_streaks table
CREATE TABLE IF NOT EXISTS "public"."user_streaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "longest_streak" integer DEFAULT 0 NOT NULL,
    "last_activity_date" date,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

-- Create unique constraint on user_id
CREATE UNIQUE INDEX IF NOT EXISTS "user_streaks_user_id_unique" ON "public"."user_streaks" USING btree ("user_id");

-- Enable RLS
ALTER TABLE "public"."user_streaks" ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own streaks" ON "public"."user_streaks"
    FOR SELECT USING ("auth"."uid"() = "user_id");

-- Users should not be able to directly insert or update their streaks.
-- This will be handled by the trigger function.
-- CREATE POLICY "Users can insert their own streaks" ON "public"."user_streaks"
--     FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");

-- CREATE POLICY "Users can update their own streaks" ON "public"."user_streaks"
--     FOR UPDATE USING ("auth"."uid"() = "user_id");

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = "timezone"('utc'::"text", "now"());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "set_user_streaks_updated_at" ON "public"."user_streaks";
CREATE TRIGGER "set_user_streaks_updated_at"
    BEFORE UPDATE ON "public"."user_streaks"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_updated_at"();

-- Grant permissions
GRANT ALL ON TABLE "public"."user_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_streaks" TO "service_role";

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS "user_streaks_user_id_idx" ON "public"."user_streaks" USING btree ("user_id");

-- Function to update user streak
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date)
  VALUES (NEW.user_id, 1, 1, CURRENT_DATE)
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak =
      CASE
        -- If the last activity was yesterday, increment the streak
        WHEN user_streaks.last_activity_date = (CURRENT_DATE - INTERVAL '1 day') THEN user_streaks.current_streak + 1
        -- If the last activity was today, keep the streak the same
        WHEN user_streaks.last_activity_date = CURRENT_DATE THEN user_streaks.current_streak
        -- Otherwise, the streak is broken, reset to 1
        ELSE 1
      END,
    longest_streak =
      CASE
        -- If the last activity was yesterday and the new streak is longer, update longest_streak
        WHEN user_streaks.last_activity_date = (CURRENT_DATE - INTERVAL '1 day') THEN GREATEST(user_streaks.longest_streak, user_streaks.current_streak + 1)
        -- Otherwise, keep the longest_streak the same (or set it to 1 if this is the first application)
        ELSE GREATEST(user_streaks.longest_streak, 1)
      END,
    last_activity_date = CURRENT_DATE;
  RETURN NEW;
END;
$$;

-- Trigger to update user streak on new job application
DROP TRIGGER IF EXISTS "on_new_job_application_update_streak" ON "public"."jobs";
CREATE TRIGGER "on_new_job_application_update_streak"
    AFTER INSERT ON "public"."jobs"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_user_streak"();
