-- Migration: 20260911140000_create_promotions_engine.sql
-- Personalized Promotion Engine V1 Schema
-- Establishes server-authoritative campaigns, persistent user assignments, and event tracking with strict RLS.

-- 1. Promotion Campaigns Table
CREATE TABLE IF NOT EXISTS public.promotion_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  min_discount integer NOT NULL DEFAULT 0 CHECK (min_discount >= 0 AND min_discount <= max_discount),
  max_discount integer NOT NULL DEFAULT 40 CHECK (max_discount <= 100),
  eligible_plans text[] DEFAULT '{}'::text[],
  target_plans text[] DEFAULT '{}'::text[],
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Promotion Assignments Table (Persistent User State)
CREATE TABLE IF NOT EXISTS public.promotion_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.promotion_campaigns(id) ON DELETE SET NULL,
  incentive_type text NOT NULL CHECK (incentive_type IN ('none', 'percentage_discount', 'bonus_credits', 'bonus_auto_apply_runs', 'annual_plan_discount', 'trial_upgrade')),
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  bonus_credits integer NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  bonus_auto_apply_runs integer NOT NULL DEFAULT 0 CHECK (bonus_auto_apply_runs >= 0),
  target_plan text,
  message_variant text NOT NULL CHECK (message_variant IN ('value', 'usage_limit', 'progress', 'momentum', 'returning_user', 'checkout_recovery', 'retention', 'urgency')),
  placement text NOT NULL CHECK (placement IN ('top_banner', 'pricing_page', 'upgrade_modal', 'dashboard_card')),
  headline text,
  body text,
  cta_label text,
  experiment_key text NOT NULL DEFAULT 'default',
  experiment_variant text NOT NULL CHECK (experiment_variant IN ('control', 'treatment')),
  decision_reason text NOT NULL,
  decision_score numeric(5,2),
  model_version text NOT NULL DEFAULT 'v1.0.0',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'dismissed', 'cancelled')),
  converted_at timestamptz,
  converted_order_id text,
  converted_amount numeric(10,2),
  converted_currency text,
  user_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Promotion Events Table (Deduplicated Audit Trail & Funnel Telemetry)
CREATE TABLE IF NOT EXISTS public.promotion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES public.promotion_assignments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.promotion_campaigns(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('assigned', 'impression', 'clicked', 'checkout_started', 'converted', 'dismissed', 'expired', 'cancelled')),
  placement text NOT NULL CHECK (placement IN ('top_banner', 'pricing_page', 'upgrade_modal', 'dashboard_card')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Indexes for Performance & Idempotency Lookups
CREATE INDEX IF NOT EXISTS idx_promotion_campaigns_status
  ON public.promotion_campaigns (status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_promotion_assignments_user_active
  ON public.promotion_assignments (user_id, status, expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_promotion_assignments_campaign
  ON public.promotion_assignments (campaign_id, experiment_variant, status);

CREATE INDEX IF NOT EXISTS idx_promotion_events_assignment_type
  ON public.promotion_events (assignment_id, event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_promotion_events_user_recent
  ON public.promotion_events (user_id, event_type, created_at DESC);

-- Unique index to prevent concurrent active assignment creation races
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_assignments_user_campaign_active
  ON public.promotion_assignments (user_id, campaign_id)
  WHERE status = 'active';

-- 5. Row Level Security Configuration
ALTER TABLE public.promotion_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_events ENABLE ROW LEVEL SECURITY;

-- 5a. promotion_campaigns RLS (Confidential strategy & configuration fields accessible service_role only)
DROP POLICY IF EXISTS "Authenticated users can view active campaigns" ON public.promotion_campaigns;
REVOKE ALL ON public.promotion_campaigns FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promotion_campaigns TO service_role;

-- 5b. promotion_assignments RLS (Users may only SELECT their own assignments; mutations service_role only)
DROP POLICY IF EXISTS "Users can view their own promotion assignments" ON public.promotion_assignments;
CREATE POLICY "Users can view their own promotion assignments"
  ON public.promotion_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.promotion_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.promotion_assignments TO authenticated;
GRANT ALL ON public.promotion_assignments TO service_role;

-- 5c. promotion_events RLS (Users may SELECT own events; INSERT restricted strictly to low-trust interaction telemetry)
DROP POLICY IF EXISTS "Users can view their own promotion events" ON public.promotion_events;
CREATE POLICY "Users can view their own promotion events"
  ON public.promotion_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own promotion events" ON public.promotion_events;
DROP POLICY IF EXISTS "Users can insert low-trust interaction promotion events" ON public.promotion_events;
CREATE POLICY "Users can insert low-trust interaction promotion events"
  ON public.promotion_events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    event_type IN ('impression', 'clicked', 'dismissed')
  );

REVOKE UPDATE, DELETE, TRUNCATE ON public.promotion_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.promotion_events TO authenticated;
GRANT ALL ON public.promotion_events TO service_role;

-- 6. Seed Default V1 Promotion Campaign
INSERT INTO public.promotion_campaigns (slug, name, status, min_discount, max_discount, config)
VALUES (
  'default_v1_campaign',
  'Jobraker V1 Dynamic Activation & Retention Campaign',
  'active',
  0,
  40,
  '{"holdout_pct": 10, "default_duration_hours": 24, "max_impressions_7d": 2, "cooldown_days": 7}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
