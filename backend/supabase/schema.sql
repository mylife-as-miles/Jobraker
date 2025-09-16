

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."match_jobs"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "uuid", "job_title" "text", "company_name" "text", "location" "text", "work_type" "text", "experience_level" "text", "required_skills" "text"[], "full_job_description" "text", "source_url" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    jl.id,
    jl.job_title,
    jl.company_name,
    jl.location,
    jl.work_type,
    jl.experience_level,
    jl.required_skills,
    jl.full_job_description,
    jl.source_url,
    1 - (jl.description_embedding <=> query_embedding) AS similarity
  FROM
    job_listings AS jl
  WHERE 1 - (jl.description_embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_jobs"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appearance_settings" (
    "id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'auto'::"text",
    "accent_color" "text" DEFAULT '#1dff00'::"text",
    "reduce_motion" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "appearance_settings_theme_check" CHECK (("theme" = ANY (ARRAY['dark'::"text", 'light'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."appearance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "location" "text" DEFAULT ''::"text",
    "applied_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'Applied'::"text" NOT NULL,
    "salary" "text",
    "notes" "text",
    "next_step" "text",
    "interview_date" timestamp with time zone,
    "logo" "text",
    "run_id" "text",
    "workflow_id" "text",
    "app_url" "text",
    "provider_status" "text",
    "recording_url" "text",
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "applications_status_check" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'Applied'::"text", 'Interview'::"text", 'Offer'::"text", 'Rejected'::"text", 'Withdrawn'::"text"])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "location" "text",
    "years_of_experience" numeric,
    "core_skills" "text"[],
    "work_experience" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_title" "text",
    "company_name" "text",
    "location" "text",
    "work_type" "text",
    "experience_level" "text",
    "required_skills" "text"[],
    "full_job_description" "text",
    "description_embedding" "public"."vector"(384),
    "source_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "requirements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "benefits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "salary_period" "text",
    "salary_currency" "text"
);


ALTER TABLE "public"."job_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_source_configs" (
    "user_id" "uuid" NOT NULL,
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_source_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_source_configs" IS 'Per-user job ingestion source configuration stored as JSON array';



COMMENT ON COLUMN "public"."job_source_configs"."sources" IS 'Array of { id:number, type:string, query:string, enabled:boolean }';



CREATE TABLE IF NOT EXISTS "public"."job_source_settings" (
    "id" "uuid" NOT NULL,
    "include_linkedin" boolean DEFAULT true NOT NULL,
    "include_indeed" boolean DEFAULT true NOT NULL,
    "include_search" boolean DEFAULT true NOT NULL,
    "allowed_domains" "text"[],
    "enabled_sources" "text"[],
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_source_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" NOT NULL,
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "job_alerts" boolean DEFAULT true,
    "application_updates" boolean DEFAULT true,
    "weekly_digest" boolean DEFAULT false,
    "marketing_emails" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "company" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_starred" boolean DEFAULT false,
    "action_url" "text",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['interview'::"text", 'application'::"text", 'system'::"text", 'company'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parsed_resumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resume_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "raw_text" "text" NOT NULL,
    "json" "jsonb",
    "extracted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "structured" "jsonb",
    "skills" "text"[],
    "embedding" "public"."vector"(256)
);


ALTER TABLE "public"."parsed_resumes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."privacy_settings" (
    "id" "uuid" NOT NULL,
    "is_profile_public" boolean DEFAULT false,
    "show_email" boolean DEFAULT false,
    "allow_search_indexing" boolean DEFAULT false,
    "share_analytics" boolean DEFAULT false,
    "personalized_ads" boolean DEFAULT false,
    "resume_default_public" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."privacy_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_education" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "degree" "text" NOT NULL,
    "school" "text" NOT NULL,
    "location" "text" DEFAULT ''::"text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "gpa" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_education" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_experiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "company" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "is_current" boolean DEFAULT false NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_experiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "level" "text",
    "category" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_skills_level_check" CHECK (("level" = ANY (ARRAY['Beginner'::"text", 'Intermediate'::"text", 'Advanced'::"text", 'Expert'::"text"])))
);


ALTER TABLE "public"."profile_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "job_title" "text",
    "experience_years" integer,
    "location" "text",
    "goals" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text",
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "template" "text",
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "applications" integer DEFAULT 0 NOT NULL,
    "thumbnail" "text",
    "is_favorite" boolean DEFAULT false NOT NULL,
    "file_path" "text",
    "file_ext" "text",
    "size" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resumes_status_check" CHECK (("status" = ANY (ARRAY['Active'::"text", 'Draft'::"text", 'Archived'::"text"])))
);


ALTER TABLE "public"."resumes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_backup_codes" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_backup_codes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."security_backup_codes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."security_backup_codes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."security_backup_codes_id_seq" OWNED BY "public"."security_backup_codes"."id";



CREATE TABLE IF NOT EXISTS "public"."security_settings" (
    "id" "uuid" NOT NULL,
    "two_factor_enabled" boolean DEFAULT false,
    "sign_in_alerts" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "factor_id" "text"
);


ALTER TABLE "public"."security_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_trusted_devices" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "device_name" "text",
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_trusted_devices" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."security_trusted_devices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."security_trusted_devices_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."security_trusted_devices_id_seq" OWNED BY "public"."security_trusted_devices"."id";



ALTER TABLE ONLY "public"."security_backup_codes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."security_backup_codes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."security_trusted_devices" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."security_trusted_devices_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."appearance_settings"
    ADD CONSTRAINT "appearance_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_listings"
    ADD CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_listings"
    ADD CONSTRAINT "job_listings_source_url_key" UNIQUE ("source_url");



ALTER TABLE ONLY "public"."job_source_configs"
    ADD CONSTRAINT "job_source_configs_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."job_source_settings"
    ADD CONSTRAINT "job_source_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parsed_resumes"
    ADD CONSTRAINT "parsed_resumes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."privacy_settings"
    ADD CONSTRAINT "privacy_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_education"
    ADD CONSTRAINT "profile_education_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_experiences"
    ADD CONSTRAINT "profile_experiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_backup_codes"
    ADD CONSTRAINT "security_backup_codes_code_hash_key" UNIQUE ("code_hash");



ALTER TABLE ONLY "public"."security_backup_codes"
    ADD CONSTRAINT "security_backup_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_settings"
    ADD CONSTRAINT "security_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_trusted_devices"
    ADD CONSTRAINT "security_trusted_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_trusted_devices"
    ADD CONSTRAINT "security_trusted_devices_user_id_device_id_key" UNIQUE ("user_id", "device_id");



CREATE INDEX "applications_run_id_idx" ON "public"."applications" USING "btree" ("run_id");



CREATE INDEX "applications_user_updated_idx" ON "public"."applications" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_notifications_user_id_created_at" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_read" ON "public"."notifications" USING "btree" ("user_id", "read");



CREATE INDEX "idx_notifications_user_starred" ON "public"."notifications" USING "btree" ("user_id", "is_starred");



CREATE INDEX "job_listings_benefits_gin" ON "public"."job_listings" USING "gin" ("benefits" "jsonb_path_ops");



CREATE INDEX "job_listings_requirements_gin" ON "public"."job_listings" USING "gin" ("requirements" "jsonb_path_ops");



CREATE INDEX "job_source_configs_updated_at_idx" ON "public"."job_source_configs" USING "btree" ("updated_at" DESC);



CREATE INDEX "parsed_resumes_embedding_hnsw_idx" ON "public"."parsed_resumes" USING "hnsw" ("embedding" "public"."vector_l2_ops");



CREATE INDEX "parsed_resumes_resume_idx" ON "public"."parsed_resumes" USING "btree" ("resume_id");



CREATE INDEX "parsed_resumes_skills_idx" ON "public"."parsed_resumes" USING "gin" ("skills");



CREATE INDEX "parsed_resumes_user_idx" ON "public"."parsed_resumes" USING "btree" ("user_id", "extracted_at" DESC);



CREATE INDEX "profile_education_user_idx" ON "public"."profile_education" USING "btree" ("user_id", "start_date" DESC);



CREATE INDEX "profile_experiences_user_idx" ON "public"."profile_experiences" USING "btree" ("user_id", "start_date" DESC);



CREATE INDEX "profile_skills_user_idx" ON "public"."profile_skills" USING "btree" ("user_id", "name");



CREATE INDEX "resumes_user_updated_idx" ON "public"."resumes" USING "btree" ("user_id", "updated_at" DESC);



CREATE OR REPLACE TRIGGER "job_source_configs_set_updated_at" BEFORE UPDATE ON "public"."job_source_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."appearance_settings"
    ADD CONSTRAINT "appearance_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_source_configs"
    ADD CONSTRAINT "job_source_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_source_settings"
    ADD CONSTRAINT "job_source_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parsed_resumes"
    ADD CONSTRAINT "parsed_resumes_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."privacy_settings"
    ADD CONSTRAINT "privacy_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_education"
    ADD CONSTRAINT "profile_education_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_experiences"
    ADD CONSTRAINT "profile_experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_backup_codes"
    ADD CONSTRAINT "security_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_settings"
    ADD CONSTRAINT "security_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_trusted_devices"
    ADD CONSTRAINT "security_trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can read jobs." ON "public"."job_listings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Delete own applications" ON "public"."applications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own backup codes" ON "public"."security_backup_codes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own devices" ON "public"."security_trusted_devices" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own notification settings" ON "public"."notification_settings" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Delete own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own privacy" ON "public"."privacy_settings" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Delete own profile education" ON "public"."profile_education" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own profile experiences" ON "public"."profile_experiences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own profile skills" ON "public"."profile_skills" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own resumes" ON "public"."resumes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own security settings" ON "public"."security_settings" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Insert own appearance" ON "public"."appearance_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Insert own applications" ON "public"."applications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own backup codes" ON "public"."security_backup_codes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own devices" ON "public"."security_trusted_devices" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own job sources" ON "public"."job_source_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Insert own notification settings" ON "public"."notification_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Insert own notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own parsed resumes" ON "public"."parsed_resumes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own privacy" ON "public"."privacy_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Insert own profile education" ON "public"."profile_education" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own profile experiences" ON "public"."profile_experiences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own profile skills" ON "public"."profile_skills" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own resumes" ON "public"."resumes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own security settings" ON "public"."security_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Read job listings" ON "public"."job_listings" FOR SELECT USING (true);



CREATE POLICY "Read own appearance" ON "public"."appearance_settings" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read own backup codes" ON "public"."security_backup_codes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Read own devices" ON "public"."security_trusted_devices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Read own job sources" ON "public"."job_source_settings" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read own notification settings" ON "public"."notification_settings" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Read own privacy" ON "public"."privacy_settings" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read own security settings" ON "public"."security_settings" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Select own applications" ON "public"."applications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Select own parsed resumes" ON "public"."parsed_resumes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Select own profile education" ON "public"."profile_education" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Select own profile experiences" ON "public"."profile_experiences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Select own profile skills" ON "public"."profile_skills" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Select own resumes" ON "public"."resumes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own appearance" ON "public"."appearance_settings" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Update own applications" ON "public"."applications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own backup codes" ON "public"."security_backup_codes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own devices" ON "public"."security_trusted_devices" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own job sources" ON "public"."job_source_settings" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Update own notification settings" ON "public"."notification_settings" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own privacy" ON "public"."privacy_settings" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Update own profile education" ON "public"."profile_education" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own profile experiences" ON "public"."profile_experiences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own profile skills" ON "public"."profile_skills" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own resumes" ON "public"."resumes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own security settings" ON "public"."security_settings" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage their own profiles." ON "public"."candidate_profiles" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."appearance_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_source_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_source_configs_delete_own" ON "public"."job_source_configs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "job_source_configs_insert_own" ON "public"."job_source_configs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "job_source_configs_select_own" ON "public"."job_source_configs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "job_source_configs_update_own" ON "public"."job_source_configs" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."job_source_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parsed_resumes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."privacy_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_education" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_experiences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resumes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_backup_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_trusted_devices" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."match_jobs"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_jobs"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_jobs"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."appearance_settings" TO "anon";
GRANT ALL ON TABLE "public"."appearance_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."appearance_settings" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_profiles" TO "anon";
GRANT ALL ON TABLE "public"."candidate_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."job_listings" TO "anon";
GRANT ALL ON TABLE "public"."job_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."job_listings" TO "service_role";



GRANT ALL ON TABLE "public"."job_source_configs" TO "anon";
GRANT ALL ON TABLE "public"."job_source_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_source_configs" TO "service_role";



GRANT ALL ON TABLE "public"."job_source_settings" TO "anon";
GRANT ALL ON TABLE "public"."job_source_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."job_source_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."parsed_resumes" TO "anon";
GRANT ALL ON TABLE "public"."parsed_resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."parsed_resumes" TO "service_role";



GRANT ALL ON TABLE "public"."privacy_settings" TO "anon";
GRANT ALL ON TABLE "public"."privacy_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."privacy_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profile_education" TO "anon";
GRANT ALL ON TABLE "public"."profile_education" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_education" TO "service_role";



GRANT ALL ON TABLE "public"."profile_experiences" TO "anon";
GRANT ALL ON TABLE "public"."profile_experiences" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_experiences" TO "service_role";



GRANT ALL ON TABLE "public"."profile_skills" TO "anon";
GRANT ALL ON TABLE "public"."profile_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_skills" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."resumes" TO "anon";
GRANT ALL ON TABLE "public"."resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."resumes" TO "service_role";



GRANT ALL ON TABLE "public"."security_backup_codes" TO "anon";
GRANT ALL ON TABLE "public"."security_backup_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."security_backup_codes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."security_backup_codes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."security_backup_codes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."security_backup_codes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."security_settings" TO "anon";
GRANT ALL ON TABLE "public"."security_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."security_settings" TO "service_role";



GRANT ALL ON TABLE "public"."security_trusted_devices" TO "anon";
GRANT ALL ON TABLE "public"."security_trusted_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."security_trusted_devices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."security_trusted_devices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."security_trusted_devices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."security_trusted_devices_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;
