-- Migration: 20260804140000_provider_cost_based_credits.sql
-- Provider-cost-based credit consumption for Firecrawl, RTRVR, and Skyvern

-- 1. Update subscription_plans table credit allocations
UPDATE public.subscription_plans
SET credits_per_month = CASE name
        WHEN 'Free' THEN 10
        WHEN 'Starter' THEN 150
        WHEN 'Basics' THEN 250
        WHEN 'Pro' THEN 600
        WHEN 'Ultimate' THEN 1250
        ELSE credits_per_month
    END
WHERE name IN ('Free', 'Starter', 'Basics', 'Pro', 'Ultimate');

-- Update monthly refill functions
CREATE OR REPLACE FUNCTION public.refill_monthly_credits()
RETURNS TABLE(user_id uuid, credits_added integer, new_balance integer)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH refill_users AS (
        SELECT uc.user_id,
               COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month) AS credits_per_month
        FROM public.user_credits uc
        LEFT JOIN public.user_subscriptions us ON us.user_id = uc.user_id AND us.status = 'active'
        LEFT JOIN public.subscription_plans subscribed_plan ON subscribed_plan.id = us.subscription_plan_id
        LEFT JOIN public.subscription_plans free_plan ON free_plan.name = 'Free'
        WHERE uc.last_refill < now() - interval '1 month'
          AND COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month, 0) > 0
    )
    UPDATE public.user_credits uc
    SET balance = uc.balance + ru.credits_per_month,
        lifetime_earned = uc.lifetime_earned + ru.credits_per_month,
        last_refill = now(),
        updated_at = now()
    FROM refill_users ru
    WHERE uc.user_id = ru.user_id
    RETURNING uc.user_id, ru.credits_per_month::integer, uc.balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_monthly_refill_transactions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.credit_transactions (user_id, transaction_type, amount, balance_after, description)
    SELECT uc.user_id,
           'refill',
           COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month),
           uc.balance,
           CASE COALESCE(subscribed_plan.name, free_plan.name)
               WHEN 'Free' THEN 'Free tier monthly credit allocation - 10 credits'
               WHEN 'Starter' THEN 'Starter tier monthly credit allocation - 150 credits'
               WHEN 'Basics' THEN 'Basics tier monthly credit allocation - 250 credits'
               WHEN 'Pro' THEN 'Pro tier monthly credit allocation - 600 credits'
               WHEN 'Ultimate' THEN 'Ultimate tier monthly credit allocation - 1250 credits'
               ELSE 'Monthly credit allocation - ' || COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month) || ' credits'
           END
    FROM public.user_credits uc
    LEFT JOIN public.user_subscriptions us ON us.user_id = uc.user_id AND us.status = 'active'
    LEFT JOIN public.subscription_plans subscribed_plan ON subscribed_plan.id = us.subscription_plan_id
    LEFT JOIN public.subscription_plans free_plan ON free_plan.name = 'Free'
    WHERE uc.updated_at > now() - interval '5 minutes'
      AND COALESCE(subscribed_plan.credits_per_month, free_plan.credits_per_month, 0) > 0
      AND NOT EXISTS (
          SELECT 1 FROM public.credit_transactions ct
          WHERE ct.user_id = uc.user_id AND ct.transaction_type = 'refill' AND ct.created_at > now() - interval '5 minutes'
      );
END;
$$;

-- 2. Create private external_provider_credit_rates table
CREATE TABLE IF NOT EXISTS public.external_provider_credit_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_plan_key TEXT NOT NULL DEFAULT 'production',
    operation_class TEXT NOT NULL,
    provider_unit_type TEXT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ NULL,
    monthly_provider_fee_nanos BIGINT NOT NULL DEFAULT 0,
    included_provider_units NUMERIC NOT NULL DEFAULT 0,
    allocated_cost_nanos_per_unit BIGINT NOT NULL,
    safety_multiplier NUMERIC NOT NULL DEFAULT 1.20,
    minimum_user_credits INT NOT NULL DEFAULT 1,
    reservation_multiplier NUMERIC NOT NULL DEFAULT 1.25,
    source TEXT NOT NULL DEFAULT 'production_account',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.external_provider_credit_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages provider rates" ON public.external_provider_credit_rates;
CREATE POLICY "Service role manages provider rates"
    ON public.external_provider_credit_rates
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Seed initial production rate rules
INSERT INTO public.external_provider_credit_rates (
    provider, provider_plan_key, operation_class, provider_unit_type,
    allocated_cost_nanos_per_unit, safety_multiplier, minimum_user_credits, reservation_multiplier, source
) VALUES
    ('firecrawl', 'production', 'search', 'credits', 830000, 1.20, 1, 1.25, 'production_account'),
    ('firecrawl', 'production', 'scrape', 'credits', 830000, 1.20, 1, 1.25, 'production_account'),
    ('firecrawl', 'production', 'map', 'credits', 830000, 1.20, 1, 1.25, 'production_account'),
    ('firecrawl', 'production', 'crawl', 'credits', 830000, 1.20, 1, 1.25, 'production_account'),
    ('rtrvr', 'production', 'run', 'credits', 10000000, 1.20, 1, 1.25, 'production_account'),
    ('rtrvr', 'production', 'scrape', 'credits', 10000000, 1.20, 1, 1.25, 'production_account'),
    ('skyvern', 'production', 'workflow_run', 'credits', 993333, 1.20, 1, 1.25, 'production_account'),
    ('skyvern', 'production', 'step', 'steps', 1500000, 1.20, 1, 1.25, 'production_account')
ON CONFLICT DO NOTHING;

-- 3. Create private external_provider_usage_events table
CREATE TABLE IF NOT EXISTS public.external_provider_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    operation_key TEXT NOT NULL,
    request_id UUID NOT NULL,
    parent_request_id UUID NULL,
    provider_request_id TEXT NULL,
    provider_run_id TEXT NULL,
    application_id UUID NULL,
    automation_attempt_id UUID NULL,
    job_search_run_id UUID NULL,
    endpoint TEXT NULL,
    provider_units NUMERIC NOT NULL DEFAULT 0,
    provider_unit_type TEXT NULL,
    provider_cost_nanos BIGINT NOT NULL DEFAULT 0,
    user_credit_cost INT NOT NULL DEFAULT 0,
    reserved_user_credits INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'failed', 'released', 'reconciliation_required')),
    usage_source TEXT NOT NULL,
    billable BOOLEAN NOT NULL DEFAULT true,
    failure_owner TEXT NULL,
    payload_hash TEXT NULL,
    reservation_expires_at TIMESTAMPTZ NULL,
    settled_at TIMESTAMPTZ NULL,
    released_at TIMESTAMPTZ NULL,
    reconciliation_required BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_usage_request_id ON public.external_provider_usage_events(request_id);
CREATE INDEX IF NOT EXISTS idx_provider_usage_user_id ON public.external_provider_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_usage_provider_run ON public.external_provider_usage_events(provider, provider_run_id);

ALTER TABLE public.external_provider_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages provider usage events" ON public.external_provider_usage_events;
CREATE POLICY "Service role manages provider usage events"
    ON public.external_provider_usage_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. RPCs

-- Reserve external provider credits
CREATE OR REPLACE FUNCTION public.reserve_external_provider_credits(
    p_user_id UUID,
    p_provider TEXT,
    p_feature_key TEXT,
    p_operation_key TEXT,
    p_request_id UUID,
    p_estimated_units NUMERIC DEFAULT 1,
    p_payload_hash TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_parent_request_id UUID DEFAULT NULL,
    p_application_id UUID DEFAULT NULL,
    p_automation_attempt_id UUID DEFAULT NULL,
    p_job_search_run_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
    v_rate RECORD;
    v_user_balance INT;
    v_cost_nanos BIGINT;
    v_billable_nanos NUMERIC;
    v_credits_to_reserve INT;
BEGIN
    -- Check for duplicate request ID
    SELECT * INTO v_existing FROM public.external_provider_usage_events WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_existing.status = 'reserved' THEN
            RETURN json_build_object(
                'success', true,
                'reused_reservation', true,
                'reservation_id', v_existing.id,
                'reserved_user_credits', v_existing.reserved_user_credits
            );
        ELSE
            RETURN json_build_object(
                'success', false,
                'reason', 'request_already_processed',
                'message', 'This provider request ID has already been completed or released.'
            );
        END IF;
    END IF;

    -- Lookup rate
    SELECT * INTO v_rate
    FROM public.external_provider_credit_rates
    WHERE provider = p_provider
      AND (operation_class = p_operation_key OR operation_class = 'run' OR operation_class = 'search')
      AND (effective_to IS NULL OR effective_to > NOW())
    ORDER BY (operation_class = p_operation_key) DESC, effective_from DESC
    LIMIT 1;

    IF NOT FOUND THEN
        -- Fallback rate defaults
        v_rate.allocated_cost_nanos_per_unit := 10000000; -- $0.01
        v_rate.safety_multiplier := 1.20;
        v_rate.minimum_user_credits := 1;
        v_rate.reservation_multiplier := 1.25;
        v_rate.provider_unit_type := 'credits';
    END IF;

    v_cost_nanos := ROUND(COALESCE(p_estimated_units, 1) * v_rate.allocated_cost_nanos_per_unit);
    v_billable_nanos := v_cost_nanos * v_rate.safety_multiplier * v_rate.reservation_multiplier;
    v_credits_to_reserve := GREATEST(v_rate.minimum_user_credits, CEIL(v_billable_nanos / 20000000.0)::INT);

    -- Lock and check wallet
    SELECT balance INTO v_user_balance
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_user_balance IS NULL OR v_user_balance < v_credits_to_reserve THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'insufficient_credits',
            'message', 'Not enough credits available for this provider operation.',
            'available', COALESCE(v_user_balance, 0),
            'required', v_credits_to_reserve
        );
    END IF;

    -- Create reservation event
    INSERT INTO public.external_provider_usage_events (
        user_id, provider, feature_key, operation_key, request_id, parent_request_id,
        application_id, automation_attempt_id, job_search_run_id, provider_units,
        provider_unit_type, provider_cost_nanos, user_credit_cost, reserved_user_credits,
        status, usage_source, payload_hash, reservation_expires_at, metadata
    ) VALUES (
        p_user_id, p_provider, p_feature_key, p_operation_key, p_request_id, p_parent_request_id,
        p_application_id, p_automation_attempt_id, p_job_search_run_id, COALESCE(p_estimated_units, 1),
        v_rate.provider_unit_type, v_cost_nanos, v_credits_to_reserve, v_credits_to_reserve,
        'reserved', 'reservation_estimate', p_payload_hash, NOW() + INTERVAL '30 minutes', p_metadata
    );

    RETURN json_build_object(
        'success', true,
        'reserved_user_credits', v_credits_to_reserve,
        'estimated_cost_nanos', v_cost_nanos
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'database_error',
            'message', SQLERRM
        );
END;
$$;

-- Settle external provider credits
CREATE OR REPLACE FUNCTION public.settle_external_provider_credits(
    p_request_id UUID,
    p_confirmed_units NUMERIC,
    p_provider_request_id TEXT DEFAULT NULL,
    p_provider_run_id TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'completed',
    p_failure_owner TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event RECORD;
    v_rate RECORD;
    v_user_balance INT;
    v_actual_cost_nanos BIGINT;
    v_billable_nanos NUMERIC;
    v_final_credit_cost INT;
    v_credits_to_deduct INT;
    v_new_balance INT;
    v_reconciliation_needed BOOLEAN := false;
    v_safe_description TEXT;
BEGIN
    SELECT * INTO v_event
    FROM public.external_provider_usage_events
    WHERE request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'reservation_not_found',
            'message', 'No active credit reservation found for this request ID.'
        );
    END IF;

    IF v_event.status = 'settled' THEN
        RETURN json_build_object(
            'success', true,
            'already_settled', true,
            'user_credit_cost', v_event.user_credit_cost
        );
    END IF;

    -- Lookup rate rule
    SELECT * INTO v_rate
    FROM public.external_provider_credit_rates
    WHERE provider = v_event.provider
      AND (operation_class = v_event.operation_key OR operation_class = 'run' OR operation_class = 'search')
    ORDER BY (operation_class = v_event.operation_key) DESC, effective_from DESC
    LIMIT 1;

    IF NOT FOUND THEN
        v_rate.allocated_cost_nanos_per_unit := 10000000;
        v_rate.safety_multiplier := 1.20;
        v_rate.minimum_user_credits := 1;
    END IF;

    v_actual_cost_nanos := ROUND(COALESCE(p_confirmed_units, v_event.provider_units, 1) * v_rate.allocated_cost_nanos_per_unit);
    v_billable_nanos := v_actual_cost_nanos * v_rate.safety_multiplier;
    v_final_credit_cost := GREATEST(v_rate.minimum_user_credits, CEIL(v_billable_nanos / 20000000.0)::INT);

    -- Lock user wallet balance
    SELECT balance INTO v_user_balance
    FROM public.user_credits
    WHERE user_id = v_event.user_id
    FOR UPDATE;

    IF v_final_credit_cost > v_user_balance THEN
        -- Bounded overage: deduct what's available without creating negative balance
        v_credits_to_deduct := COALESCE(v_user_balance, 0);
        v_reconciliation_needed := true;
    ELSE
        v_credits_to_deduct := v_final_credit_cost;
    END IF;

    -- Deduct from user_credits and credit_balances
    UPDATE public.user_credits
    SET balance = GREATEST(balance - v_credits_to_deduct, 0),
        lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
        updated_at = NOW()
    WHERE user_id = v_event.user_id
    RETURNING balance INTO v_new_balance;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'credit_balances'
    ) THEN
        UPDATE public.credit_balances
        SET available = GREATEST(available - v_credits_to_deduct, 0),
            lifetime_spent = COALESCE(lifetime_spent, 0) + v_credits_to_deduct,
            updated_at = NOW()
        WHERE user_id = v_event.user_id;
    END IF;

    -- Safe customer-facing description
    v_safe_description := CASE v_event.provider
        WHEN 'firecrawl' THEN 'Job discovery'
        WHEN 'rtrvr' THEN 'Browser automation'
        WHEN 'skyvern' THEN 'Application automation'
        ELSE 'External provider execution'
    END;

    -- Insert credit transaction log
    INSERT INTO public.credit_transactions (
        user_id, transaction_type, amount, balance_after, description, reference_type, reference_id, metadata
    ) VALUES (
        v_event.user_id, 'deduction', v_credits_to_deduct, COALESCE(v_new_balance, 0),
        v_safe_description, v_event.provider, p_request_id::text,
        jsonb_build_object(
            'provider', v_event.provider,
            'feature_key', v_event.feature_key,
            'operation_key', v_event.operation_key
        )
    );

    -- Update usage event
    UPDATE public.external_provider_usage_events
    SET status = 'settled',
        settled_at = NOW(),
        provider_request_id = COALESCE(p_provider_request_id, provider_request_id),
        provider_run_id = COALESCE(p_provider_run_id, provider_run_id),
        provider_units = COALESCE(p_confirmed_units, provider_units),
        provider_cost_nanos = v_actual_cost_nanos,
        user_credit_cost = v_credits_to_deduct,
        failure_owner = p_failure_owner,
        reconciliation_required = v_reconciliation_needed,
        metadata = COALESCE(p_metadata, '{}'::jsonb) || metadata
    WHERE request_id = p_request_id;

    RETURN json_build_object(
        'success', true,
        'user_credit_cost', v_credits_to_deduct,
        'new_balance', v_new_balance,
        'reconciliation_required', v_reconciliation_needed
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'database_error',
            'message', SQLERRM
        );
END;
$$;

-- Release external provider credits
CREATE OR REPLACE FUNCTION public.release_external_provider_credits(
    p_request_id UUID,
    p_reason TEXT DEFAULT 'execution_cancelled',
    p_failure_owner TEXT DEFAULT 'jobraker',
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event RECORD;
BEGIN
    SELECT * INTO v_event
    FROM public.external_provider_usage_events
    WHERE request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'reservation_not_found',
            'message', 'No reservation found to release.'
        );
    END IF;

    IF v_event.status IN ('settled', 'released', 'failed') THEN
        RETURN json_build_object(
            'success', true,
            'already_released', true,
            'status', v_event.status
        );
    END IF;

    UPDATE public.external_provider_usage_events
    SET status = 'released',
        released_at = NOW(),
        failure_owner = p_failure_owner,
        metadata = COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('release_reason', p_reason) || metadata
    WHERE request_id = p_request_id;

    RETURN json_build_object(
        'success', true,
        'released_credits', v_event.reserved_user_credits
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'database_error',
            'message', SQLERRM
        );
END;
$$;

-- Mark reconciliation required
CREATE OR REPLACE FUNCTION public.mark_external_provider_reconciliation_required(
    p_request_id UUID,
    p_reason TEXT DEFAULT 'unspecified_discrepancy',
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.external_provider_usage_events
    SET reconciliation_required = true,
        metadata = COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('reconciliation_reason', p_reason) || metadata
    WHERE request_id = p_request_id;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_external_provider_credits(UUID, TEXT, TEXT, TEXT, UUID, NUMERIC, TEXT, JSONB, UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_external_provider_credits(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_external_provider_credits(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_external_provider_reconciliation_required(UUID, TEXT, JSONB) TO service_role;
