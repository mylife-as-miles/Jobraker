

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


SET default_tablespace = '';

SET default_table_access_method = "heap";


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



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "resumes_user_updated_idx" ON "public"."resumes" USING "btree" ("user_id", "updated_at" DESC);



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



CREATE POLICY "Delete own backup codes" ON "public"."security_backup_codes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own devices" ON "public"."security_trusted_devices" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own notification settings" ON "public"."notification_settings" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Delete own resumes" ON "public"."resumes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own security settings" ON "public"."security_settings" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Insert own backup codes" ON "public"."security_backup_codes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own devices" ON "public"."security_trusted_devices" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own notification settings" ON "public"."notification_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Insert own resumes" ON "public"."resumes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own security settings" ON "public"."security_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Read own backup codes" ON "public"."security_backup_codes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Read own devices" ON "public"."security_trusted_devices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Read own notification settings" ON "public"."notification_settings" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read own security settings" ON "public"."security_settings" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Select own resumes" ON "public"."resumes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own backup codes" ON "public"."security_backup_codes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own devices" ON "public"."security_trusted_devices" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own notification settings" ON "public"."notification_settings" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Update own resumes" ON "public"."resumes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own security settings" ON "public"."security_settings" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resumes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_backup_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_trusted_devices" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



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
