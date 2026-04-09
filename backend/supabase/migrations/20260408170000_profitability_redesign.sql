-- Profitability redesign:
-- 1. Move checkout to server-side catalog truth.
-- 2. Split governed auto-apply from generic search/AI credits.
-- 3. Refresh plan packaging to match actual cost profile.

ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS auto_apply_monthly_limit integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.credit_pack_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    price_usd numeric(10, 2) NOT NULL CHECK (price_usd >= 0),
    currency text NOT NULL DEFAULT 'USD',
    credits integer NOT NULL CHECK (credits >= 0),
    bonus_credits integer NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
    is_active boolean NOT NULL DEFAULT true,
    is_popular boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_feature_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_key text NOT NULL,
    source text NOT NULL DEFAULT 'subscription',
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    included_quantity integer NOT NULL DEFAULT 0 CHECK (included_quantity >= 0),
    used_quantity integer NOT NULL DEFAULT 0 CHECK (used_quantity >= 0),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_feature_quotas_period_check CHECK (period_end > period_start),
    CONSTRAINT user_feature_quotas_unique UNIQUE (user_id, feature_key, source, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_user_feature_quotas_lookup
    ON public.user_feature_quotas(user_id, feature_key, period_end DESC);

CREATE TABLE IF NOT EXISTS public.feature_usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_key text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    reference_type text,
    reference_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_events_user_feature
    ON public.feature_usage_events(user_id, feature_key, created_at DESC);

ALTER TABLE public.credit_pack_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active credit packs" ON public.credit_pack_catalog;
CREATE POLICY "Authenticated users can view active credit packs"
    ON public.credit_pack_catalog
    FOR SELECT
    TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active credit packs" ON public.credit_pack_catalog;
CREATE POLICY "Public can view active credit packs"
    ON public.credit_pack_catalog
    FOR SELECT
    TO anon
    USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage credit packs" ON public.credit_pack_catalog;
CREATE POLICY "Service role can manage credit packs"
    ON public.credit_pack_catalog
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own feature quotas" ON public.user_feature_quotas;
CREATE POLICY "Users can view own feature quotas"
    ON public.user_feature_quotas
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage feature quotas" ON public.user_feature_quotas;
CREATE POLICY "Service role can manage feature quotas"
    ON public.user_feature_quotas
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own feature usage events" ON public.feature_usage_events;
CREATE POLICY "Users can view own feature usage events"
    ON public.feature_usage_events
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage feature usage events" ON public.feature_usage_events;
CREATE POLICY "Service role can manage feature usage events"
    ON public.feature_usage_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

UPDATE public.subscription_plans
SET
    price = CASE name
        WHEN 'Free' THEN 0
        WHEN 'Basics' THEN 19
        WHEN 'Pro' THEN 59
        WHEN 'Ultimate' THEN 149
        ELSE price
    END,
    credits_per_month = CASE name
        WHEN 'Free' THEN 10
        WHEN 'Basics' THEN 250
        WHEN 'Pro' THEN 1200
        WHEN 'Ultimate' THEN 3500
        ELSE credits_per_month
    END,
    auto_apply_monthly_limit = CASE name
        WHEN 'Free' THEN 0
        WHEN 'Basics' THEN 15
        WHEN 'Pro' THEN 50
        WHEN 'Ultimate' THEN 150
        ELSE auto_apply_monthly_limit
    END,
    description = CASE name
        WHEN 'Free' THEN 'Core search and resume tools for getting started'
        WHEN 'Basics' THEN 'High-signal search, drafting, and governed automation for active job seekers'
        WHEN 'Pro' THEN 'Faster throughput, deeper personalization, and higher automation capacity'
        WHEN 'Ultimate' THEN 'Scaled search and governed automation for power users and concierge workflows'
        ELSE description
    END,
    features = CASE name
        WHEN 'Free' THEN jsonb_build_array(
            jsonb_build_object('name', 'Search & AI Credits', 'value', '10 per month', 'included', true),
            jsonb_build_object('name', 'Resume Builder & Storage', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Resume Import & Parsing', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Application Tracking', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Manual Apply Workflow', 'value', 'Included', 'included', true)
        )
        WHEN 'Basics' THEN jsonb_build_array(
            jsonb_build_object('name', 'Search & AI Credits', 'value', '250 per month', 'included', true),
            jsonb_build_object('name', 'Governed Auto Apply', 'value', '15 runs per month', 'included', true),
            jsonb_build_object('name', 'Hybrid Discovery', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Structured Job Evaluation', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Resume Tailoring & Cover Letters', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Candidate Memory', 'value', 'Included', 'included', true)
        )
        WHEN 'Pro' THEN jsonb_build_array(
            jsonb_build_object('name', 'Search & AI Credits', 'value', '1,200 per month', 'included', true),
            jsonb_build_object('name', 'Governed Auto Apply', 'value', '50 runs per month', 'included', true),
            jsonb_build_object('name', 'Everything in Basics', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'AI Chat Assistant', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Advanced Analytics', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Interview Story Builder', 'value', 'Included', 'included', true)
        )
        WHEN 'Ultimate' THEN jsonb_build_array(
            jsonb_build_object('name', 'Search & AI Credits', 'value', '3,500 per month', 'included', true),
            jsonb_build_object('name', 'Governed Auto Apply', 'value', '150 runs per month', 'included', true),
            jsonb_build_object('name', 'Everything in Pro', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Tracked Company Intelligence', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Custom Integrations', 'value', 'Included', 'included', true),
            jsonb_build_object('name', 'Priority Support', 'value', 'Included', 'included', true)
        )
        ELSE features
    END,
    updated_at = now()
WHERE name IN ('Free', 'Basics', 'Pro', 'Ultimate');

INSERT INTO public.credit_pack_catalog (
    sku,
    name,
    description,
    price_usd,
    currency,
    credits,
    bonus_credits,
    is_active,
    is_popular,
    sort_order
) VALUES
    ('search_150', 'Starter Pack', 'For targeted search bursts and a few extra AI drafts.', 15, 'USD', 150, 0, true, false, 1),
    ('search_600', 'Growth Pack', 'A strong top-up for search, evaluation, and document generation.', 49, 'USD', 600, 75, true, true, 2),
    ('search_1500', 'Pro Pack', 'For heavy search weeks and lots of tailored application materials.', 99, 'USD', 1500, 250, true, false, 3),
    ('search_4000', 'Scale Pack', 'Best for recruiters, agencies, and sustained high-volume search research.', 229, 'USD', 4000, 1000, true, false, 4)
ON CONFLICT (sku)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_usd = EXCLUDED.price_usd,
    currency = EXCLUDED.currency,
    credits = EXCLUDED.credits,
    bonus_credits = EXCLUDED.bonus_credits,
    is_active = EXCLUDED.is_active,
    is_popular = EXCLUDED.is_popular,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.check_auto_apply_quota(
    p_user_id uuid,
    p_requested_quantity integer DEFAULT 1
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription record;
    v_period_start timestamptz;
    v_period_end timestamptz;
    v_quota record;
    v_remaining integer := 0;
BEGIN
    IF p_requested_quantity <= 0 THEN
        RETURN json_build_object(
            'available', false,
            'required', p_requested_quantity,
            'remaining', 0,
            'message', 'Requested quantity must be greater than 0.'
        );
    END IF;

    SELECT
        us.current_period_start,
        us.current_period_end,
        us.created_at,
        sp.name AS plan_name,
        COALESCE(sp.auto_apply_monthly_limit, 0) AS included_quantity
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp
      ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF NOT FOUND OR COALESCE(v_subscription.included_quantity, 0) <= 0 THEN
        RETURN json_build_object(
            'available', false,
            'required', p_requested_quantity,
            'remaining', 0,
            'included', 0,
            'used', 0,
            'message', 'Auto apply requires an active paid subscription with automation included.'
        );
    END IF;

    v_period_start := COALESCE(v_subscription.current_period_start, date_trunc('month', now()));
    v_period_end := COALESCE(v_subscription.current_period_end, v_period_start + interval '1 month');

    INSERT INTO public.user_feature_quotas (
        user_id,
        feature_key,
        source,
        period_start,
        period_end,
        included_quantity,
        metadata
    ) VALUES (
        p_user_id,
        'auto_apply',
        'subscription',
        v_period_start,
        v_period_end,
        v_subscription.included_quantity,
        jsonb_build_object('plan_name', v_subscription.plan_name)
    )
    ON CONFLICT (user_id, feature_key, source, period_start, period_end)
    DO UPDATE SET
        included_quantity = EXCLUDED.included_quantity,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    RETURNING * INTO v_quota;

    v_remaining := GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0);

    RETURN json_build_object(
        'available', v_remaining >= p_requested_quantity,
        'required', p_requested_quantity,
        'remaining', v_remaining,
        'included', v_quota.included_quantity,
        'used', v_quota.used_quantity,
        'period_end', v_quota.period_end,
        'plan_name', v_subscription.plan_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_auto_apply_quota(
    p_user_id uuid,
    p_requested_quantity integer DEFAULT 1,
    p_reference_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription record;
    v_period_start timestamptz;
    v_period_end timestamptz;
    v_quota record;
    v_remaining integer := 0;
BEGIN
    IF p_requested_quantity <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'required', p_requested_quantity,
            'remaining', 0,
            'message', 'Requested quantity must be greater than 0.'
        );
    END IF;

    SELECT
        us.current_period_start,
        us.current_period_end,
        us.created_at,
        sp.name AS plan_name,
        COALESCE(sp.auto_apply_monthly_limit, 0) AS included_quantity
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp
      ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF NOT FOUND OR COALESCE(v_subscription.included_quantity, 0) <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'required', p_requested_quantity,
            'remaining', 0,
            'message', 'Auto apply requires an active paid subscription with automation included.'
        );
    END IF;

    v_period_start := COALESCE(v_subscription.current_period_start, date_trunc('month', now()));
    v_period_end := COALESCE(v_subscription.current_period_end, v_period_start + interval '1 month');

    INSERT INTO public.user_feature_quotas (
        user_id,
        feature_key,
        source,
        period_start,
        period_end,
        included_quantity,
        metadata
    ) VALUES (
        p_user_id,
        'auto_apply',
        'subscription',
        v_period_start,
        v_period_end,
        v_subscription.included_quantity,
        jsonb_build_object('plan_name', v_subscription.plan_name)
    )
    ON CONFLICT (user_id, feature_key, source, period_start, period_end)
    DO UPDATE SET
        included_quantity = EXCLUDED.included_quantity,
        metadata = EXCLUDED.metadata,
        updated_at = now();

    SELECT *
    INTO v_quota
    FROM public.user_feature_quotas
    WHERE user_id = p_user_id
      AND feature_key = 'auto_apply'
      AND source = 'subscription'
      AND period_start = v_period_start
      AND period_end = v_period_end
    FOR UPDATE;

    v_remaining := GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0);

    IF v_remaining < p_requested_quantity THEN
        RETURN json_build_object(
            'success', false,
            'required', p_requested_quantity,
            'remaining', v_remaining,
            'included', v_quota.included_quantity,
            'used', v_quota.used_quantity,
            'period_end', v_quota.period_end,
            'plan_name', v_subscription.plan_name,
            'message', 'Not enough auto apply runs remaining for this billing period.'
        );
    END IF;

    UPDATE public.user_feature_quotas
    SET
        used_quantity = used_quantity + p_requested_quantity,
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_consumed_at', now())
    WHERE id = v_quota.id
    RETURNING * INTO v_quota;

    INSERT INTO public.feature_usage_events (
        user_id,
        feature_key,
        quantity,
        reference_type,
        reference_id,
        metadata
    ) VALUES (
        p_user_id,
        'auto_apply',
        p_requested_quantity,
        'auto_apply',
        p_reference_id,
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('plan_name', v_subscription.plan_name)
    );

    RETURN json_build_object(
        'success', true,
        'quantity_consumed', p_requested_quantity,
        'remaining', GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0),
        'included', v_quota.included_quantity,
        'used', v_quota.used_quantity,
        'period_end', v_quota.period_end,
        'plan_name', v_subscription.plan_name
    );
END;
$$;

GRANT SELECT ON public.credit_pack_catalog TO authenticated, anon;
GRANT SELECT ON public.user_feature_quotas TO authenticated;
GRANT SELECT ON public.feature_usage_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.check_auto_apply_quota(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_auto_apply_quota(uuid, integer, uuid, jsonb) TO authenticated, service_role;
