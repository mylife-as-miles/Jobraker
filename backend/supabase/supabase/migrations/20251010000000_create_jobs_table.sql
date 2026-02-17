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
