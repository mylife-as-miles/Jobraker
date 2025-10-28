-- Create credit system tables for user credits, transactions, and subscription plans
-- This allows allocation of credits to users and tracking of credit consumption

-- Subscription plans with credit allocations
CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" decimal(10,2) NOT NULL DEFAULT 0,
    "currency" "text" DEFAULT 'USD' NOT NULL,
    "billing_cycle" "text" DEFAULT 'monthly' NOT NULL,
    "credits_per_cycle" integer NOT NULL DEFAULT 0,
    "max_users" integer,
    "features" "jsonb" DEFAULT '[]'::jsonb,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "subscription_plans_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'lifetime'::text])))
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active' NOT NULL,
    "current_period_start" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false,
    "external_subscription_id" "text", -- For Stripe or other payment providers
    "trial_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'unpaid'::text, 'trialing'::text])))
);

-- User credit balances
CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "total_earned" integer DEFAULT 0 NOT NULL,
    "total_consumed" integer DEFAULT 0 NOT NULL,
    "last_reset_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "user_credits_balance_check" CHECK (("balance" >= 0))
);

-- Credit transactions for tracking all credit movements
CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "balance_before" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "description" "text",
    "reference_type" "text", -- 'subscription', 'manual', 'bonus', 'job_application', etc.
    "reference_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    CONSTRAINT "credit_transactions_type_check" CHECK (("type" = ANY (ARRAY['earned'::text, 'consumed'::text, 'refunded'::text, 'expired'::text, 'bonus'::text])))
);

-- Credit costs for different features
CREATE TABLE IF NOT EXISTS "public"."credit_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_type" "text" NOT NULL,
    "feature_name" "text" NOT NULL,
    "cost" integer NOT NULL DEFAULT 1,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::text, "now"()) NOT NULL
);

-- Primary keys
ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."credit_costs"
    ADD CONSTRAINT "credit_costs_pkey" PRIMARY KEY ("id");

-- Unique constraints
ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_unique" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."credit_costs"
    ADD CONSTRAINT "credit_costs_feature_unique" UNIQUE ("feature_type", "feature_name");

-- Foreign key constraints
ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");
CREATE INDEX "idx_user_subscriptions_status" ON "public"."user_subscriptions" USING "btree" ("status");
CREATE INDEX "idx_user_subscriptions_period_end" ON "public"."user_subscriptions" USING "btree" ("current_period_end");

CREATE INDEX "idx_user_credits_user_id" ON "public"."user_credits" USING "btree" ("user_id");

CREATE INDEX "idx_credit_transactions_user_id" ON "public"."credit_transactions" USING "btree" ("user_id");
CREATE INDEX "idx_credit_transactions_type" ON "public"."credit_transactions" USING "btree" ("type");
CREATE INDEX "idx_credit_transactions_created_at" ON "public"."credit_transactions" USING "btree" ("created_at" DESC);
CREATE INDEX "idx_credit_transactions_reference" ON "public"."credit_transactions" USING "btree" ("reference_type", "reference_id");

CREATE INDEX "idx_credit_costs_feature_active" ON "public"."credit_costs" USING "btree" ("feature_type", "is_active");

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" 
    BEFORE UPDATE ON "public"."subscription_plans" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_user_subscriptions_updated_at" 
    BEFORE UPDATE ON "public"."user_subscriptions" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_user_credits_updated_at" 
    BEFORE UPDATE ON "public"."user_credits" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_credit_costs_updated_at" 
    BEFORE UPDATE ON "public"."credit_costs" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Row Level Security policies
ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_costs" ENABLE ROW LEVEL SECURITY;

-- Subscription plans - readable by all authenticated users
CREATE POLICY "Read subscription plans" ON "public"."subscription_plans" 
    FOR SELECT USING (auth.role() = 'authenticated');

-- User subscriptions - users can only see their own
CREATE POLICY "Read own subscriptions" ON "public"."user_subscriptions" 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Insert own subscriptions" ON "public"."user_subscriptions" 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own subscriptions" ON "public"."user_subscriptions" 
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User credits - users can only see their own
CREATE POLICY "Read own credits" ON "public"."user_credits" 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Insert own credits" ON "public"."user_credits" 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own credits" ON "public"."user_credits" 
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Credit transactions - users can only see their own
CREATE POLICY "Read own credit transactions" ON "public"."credit_transactions" 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Insert own credit transactions" ON "public"."credit_transactions" 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Credit costs - readable by all authenticated users
CREATE POLICY "Read credit costs" ON "public"."credit_costs" 
    FOR SELECT USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";

GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";

GRANT ALL ON TABLE "public"."user_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credits" TO "service_role";

GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";

GRANT ALL ON TABLE "public"."credit_costs" TO "anon";
GRANT ALL ON TABLE "public"."credit_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_costs" TO "service_role";