-- Migration: 20260804160000_security_harden_authorizations_and_billing.sql
-- Urgent Authorization & Billing-Security Hardening

-- 1. CANONICAL SUBSCRIPTION AUTHORITY FUNCTION
CREATE OR REPLACE FUNCTION public.get_effective_entitlements(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_tier TEXT := 'Free';
    v_active BOOLEAN := false;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_user_id IS NULL THEN
        p_user_id := auth.uid();
    END IF;

    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'effective_tier', 'Free',
            'is_active', false,
            'reason', 'unauthenticated',
            'auto_apply_access', false,
            'firecrawl_access', true,
            'rtrvr_access', false,
            'skyvern_access', false,
            'composio_access', false,
            'credits_included', 10,
            'auto_apply_quantity', 2,
            'concurrency', 1
        );
    END IF;

    -- Query active, non-expired subscription
    SELECT us.*, sp.name as plan_name, sp.credits_per_month, sp.auto_apply_runs_per_month, sp.auto_apply_concurrency
    INTO v_sub
    FROM public.user_subscriptions us
    LEFT JOIN public.subscription_plans sp ON sp.id = us.subscription_plan_id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND (us.current_period_end IS NULL OR us.current_period_end > v_now)
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF FOUND AND v_sub.plan_name IS NOT NULL THEN
        v_tier := v_sub.plan_name;
        v_active := true;
    END IF;

    -- Determine feature flags based on effective active tier
    CASE v_tier
        WHEN 'Starter' THEN
            RETURN jsonb_build_object(
                'effective_tier', 'Starter',
                'is_active', true,
                'period_start', v_sub.current_period_start,
                'period_end', v_sub.current_period_end,
                'ai_allowance', 'starter',
                'credits_included', 150,
                'auto_apply_access', false,
                'auto_apply_quantity', 0,
                'concurrency', 0,
                'firecrawl_access', true,
                'rtrvr_access', true,
                'skyvern_access', false,
                'composio_access', true
            );
        WHEN 'Basics' THEN
            RETURN jsonb_build_object(
                'effective_tier', 'Basics',
                'is_active', true,
                'period_start', v_sub.current_period_start,
                'period_end', v_sub.current_period_end,
                'ai_allowance', 'basics',
                'credits_included', 250,
                'auto_apply_access', true,
                'auto_apply_quantity', COALESCE(v_sub.auto_apply_runs_per_month, 15),
                'concurrency', COALESCE(v_sub.auto_apply_concurrency, 2),
                'firecrawl_access', true,
                'rtrvr_access', true,
                'skyvern_access', true,
                'composio_access', true
            );
        WHEN 'Pro' THEN
            RETURN jsonb_build_object(
                'effective_tier', 'Pro',
                'is_active', true,
                'period_start', v_sub.current_period_start,
                'period_end', v_sub.current_period_end,
                'ai_allowance', 'pro',
                'credits_included', 600,
                'auto_apply_access', true,
                'auto_apply_quantity', COALESCE(v_sub.auto_apply_runs_per_month, 50),
                'concurrency', COALESCE(v_sub.auto_apply_concurrency, 4),
                'firecrawl_access', true,
                'rtrvr_access', true,
                'skyvern_access', true,
                'composio_access', true
            );
        WHEN 'Ultimate' THEN
            RETURN jsonb_build_object(
                'effective_tier', 'Ultimate',
                'is_active', true,
                'period_start', v_sub.current_period_start,
                'period_end', v_sub.current_period_end,
                'ai_allowance', 'ultimate',
                'credits_included', 1250,
                'auto_apply_access', true,
                'auto_apply_quantity', COALESCE(v_sub.auto_apply_runs_per_month, 150),
                'concurrency', COALESCE(v_sub.auto_apply_concurrency, 8),
                'firecrawl_access', true,
                'rtrvr_access', true,
                'skyvern_access', true,
                'composio_access', true
            );
        ELSE
            -- Free tier fallback (expired or free user)
            RETURN jsonb_build_object(
                'effective_tier', 'Free',
                'is_active', false,
                'period_start', NULL,
                'period_end', NULL,
                'ai_allowance', 'free',
                'credits_included', 10,
                'auto_apply_access', false,
                'auto_apply_quantity', 2,
                'concurrency', 1,
                'firecrawl_access', true,
                'rtrvr_access', false,
                'skyvern_access', false,
                'composio_access', false
            );
    END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_entitlements(UUID) TO authenticated, service_role;

-- 2. HARDENED GET_USER_EMAIL RPC
CREATE OR REPLACE FUNCTION public.get_user_email(user_id UUID)
RETURNS TABLE (email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Protect user email privacy: only allow self-read, service_role, or verified admin
    IF auth.uid() IS NOT NULL AND auth.uid() <> user_id AND NOT (
        EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'
        )
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT au.email
    FROM auth.users AS au
    WHERE au.id = user_id;
END;
$$;

-- 3. ADMIN ESCALATION & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL,
    target_user_id UUID NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Service role manages admin audit logs"
    ON public.admin_audit_logs FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'
        )
    );

-- Isolated assign_admin_role (service role only)
CREATE OR REPLACE FUNCTION public.assign_admin_role(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Strictly require service_role
    IF current_setting('role', true) <> 'service_role' AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: assign_admin_role is restricted exclusively to service_role.';
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.admin_audit_logs (admin_user_id, target_user_id, action)
    VALUES (COALESCE(auth.uid(), target_user_id), target_user_id, 'assign_admin_role');
END;
$$;

-- 4. ORDERS TABLE SECURITY & POLICIES
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role manages orders" ON public.orders;
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;

CREATE POLICY "Service role manages orders"
    ON public.orders FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Users view own orders"
    ON public.orders FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

-- 5. CREDIT TABLES SECURITY, CONSTRAINTS & IMMUTABLE LEDGER
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Revoke browser mutations
REVOKE INSERT, UPDATE, DELETE ON public.user_credits FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.credit_balances FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.credit_holds FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.credit_ledger_entries FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.credit_transactions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.user_credits TO authenticated;
GRANT SELECT ON public.credit_balances TO authenticated;
GRANT SELECT ON public.credit_holds TO authenticated;
GRANT SELECT ON public.credit_ledger_entries TO authenticated;
GRANT SELECT ON public.credit_transactions TO authenticated;

GRANT ALL ON public.user_credits, public.credit_balances, public.credit_holds, public.credit_ledger_entries, public.credit_transactions TO service_role;

-- Remove self-update policies on user_credits
DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;
CREATE POLICY "Users view own user_credits"
    ON public.user_credits FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- CHECK Constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_credits_balance') THEN
        ALTER TABLE public.user_credits ADD CONSTRAINT chk_user_credits_balance CHECK (balance >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_credits_earned') THEN
        ALTER TABLE public.user_credits ADD CONSTRAINT chk_user_credits_earned CHECK (lifetime_earned >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_credits_spent') THEN
        ALTER TABLE public.user_credits ADD CONSTRAINT chk_user_credits_spent CHECK (lifetime_spent >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_credit_balances_available') THEN
        ALTER TABLE public.credit_balances ADD CONSTRAINT chk_credit_balances_available CHECK (available >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_credit_balances_reserved') THEN
        ALTER TABLE public.credit_balances ADD CONSTRAINT chk_credit_balances_reserved CHECK (reserved >= 0);
    END IF;
END $$;

-- Immutable ledger trigger
CREATE OR REPLACE FUNCTION public.prevent_ledger_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('role', true) <> 'service_role' THEN
        RAISE EXCEPTION 'Ledger entries and transaction logs are immutable and cannot be updated or deleted.';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_credit_transactions_tampering ON public.credit_transactions;
CREATE TRIGGER trg_prevent_credit_transactions_tampering
    BEFORE UPDATE OR DELETE ON public.credit_transactions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_tampering();

DROP TRIGGER IF EXISTS trg_prevent_credit_ledger_tampering ON public.credit_ledger_entries;
CREATE TRIGGER trg_prevent_credit_ledger_tampering
    BEFORE UPDATE OR DELETE ON public.credit_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_tampering();

-- 6. AGENT RUNS & APPLICATIONS PROTECTIONS
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.agent_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;

DROP POLICY IF EXISTS "Users can view own agent_runs" ON public.agent_runs;
CREATE POLICY "Users can view own agent_runs"
    ON public.agent_runs FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Application automation column protection trigger
CREATE OR REPLACE FUNCTION public.protect_application_automation_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Allow service_role to update any field
    IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Block browser changes to system automation & billing columns
    IF (NEW.automation_provider IS DISTINCT FROM OLD.automation_provider) OR
       (NEW.automation_idempotency_key IS DISTINCT FROM OLD.automation_idempotency_key) OR
       (NEW.automation_claimed_by IS DISTINCT FROM OLD.automation_claimed_by) OR
       (NEW.automation_lease_token IS DISTINCT FROM OLD.automation_lease_token) OR
       (NEW.automation_lease_expires_at IS DISTINCT FROM OLD.automation_lease_expires_at) OR
       (NEW.automation_heartbeat_at IS DISTINCT FROM OLD.automation_heartbeat_at) OR
       (NEW.automation_attempt_number IS DISTINCT FROM OLD.automation_attempt_number) OR
       (NEW.provider_status IS DISTINCT FROM OLD.provider_status) OR
       (NEW.provider_run_output IS DISTINCT FROM OLD.provider_run_output) OR
       (NEW.run_id IS DISTINCT FROM OLD.run_id) OR
       (NEW.retry_count IS DISTINCT FROM OLD.retry_count) THEN
        RAISE EXCEPTION 'Unauthorized attempt to modify system automation or billing fields.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_application_automation_fields ON public.applications;
CREATE TRIGGER trg_protect_application_automation_fields
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.protect_application_automation_fields();

-- Safe user RPCs for legitimate application actions
CREATE OR REPLACE FUNCTION public.update_application_notes(p_application_id UUID, p_notes TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.applications
    SET notes = p_notes, updated_at = NOW()
    WHERE id = p_application_id AND user_id = auth.uid();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application not found or unauthorized');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_application_run(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.applications
    SET provider_status = 'cancelled', canonical_stage = 'failed', updated_at = NOW()
    WHERE id = p_application_id AND user_id = auth.uid() AND provider_status IN ('queued', 'waiting');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No cancellable pending run found');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_application_notes(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_pending_application_run(UUID) TO authenticated, service_role;

-- 7. WORKER & WEBHOOK REPLAY PROTECTION TABLES
CREATE TABLE IF NOT EXISTS public.worker_request_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce TEXT NOT NULL,
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_nonce_signature ON public.worker_request_nonces(nonce, signature);
ALTER TABLE public.worker_request_nonces ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.worker_request_nonces TO service_role;

CREATE TABLE IF NOT EXISTS public.webhook_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_provider_event ON public.webhook_event_logs(provider, event_id);
ALTER TABLE public.webhook_event_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.webhook_event_logs TO service_role;

-- 8. SERVICE ROLE EXECUTION GRANTS FOR SENSITIVE RPCS
DO $$
DECLARE
    r RECORD;
    v_funcs TEXT[] := ARRAY[
        'assign_admin_role', 'add_credits', 'refund_credits', 'charge_credits_v2',
        'reserve_credits_v2', 'reserve_credits_for_run', 'settle_credit_hold_v2',
        'settle_run_credits', 'settle_search_run_v2', 'release_expired_credit_holds',
        'consume_ai_chat_tool_surcharge', 'deduct_job_search_credits', 'deduct_auto_apply_credits',
        'internal_write_ledger_entry', 'internal_write_legacy_transaction',
        'claim_next_rtrvr_auto_apply_jobs', 'renew_rtrvr_auto_apply_job_lease',
        'insert_job_search_run', 'insert_job_search_result', 'expire_stale_subscriptions',
        'sync_profile_subscription_tier', 'reserve_external_provider_credits',
        'settle_external_provider_credits', 'release_external_provider_credits',
        'mark_external_provider_reconciliation_required', 'admin_get_users', 'admin_reset_user_ai_usage'
    ];
    v_fn TEXT;
BEGIN
    FOREACH v_fn IN ARRAY v_funcs LOOP
        FOR r IN SELECT oid::regprocedure AS proc_sig FROM pg_proc WHERE proname = v_fn AND pronamespace = 'public'::regnamespace LOOP
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.proc_sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.proc_sig);
        END LOOP;
    END LOOP;
END $$;
