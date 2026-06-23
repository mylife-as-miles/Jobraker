-- =============================================================================
-- Phase 0 — Application Configuration / Feature Flags Table
-- =============================================================================
-- Creates `public.app_config` — a simple key/value store for runtime feature
-- flags and configuration values consumed by Edge Functions and backend RPCs.
--
-- V2 billing rollout flags are seeded here so each component can be enabled
-- independently without a code deploy.
--
-- Naming convention for flag keys:
--   billing.v2.*          — V2 credit ledger and billing gateway flags
--   search.v2.*           — V2 run-linked search result flags
--   ingestion.*           — Job ingestion control flags
--   reconciliation.*      — Background reconciliation switches
-- =============================================================================

-- ── 1. Config table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_config (
    key          text        PRIMARY KEY,
    value        jsonb       NOT NULL,
    description  text,
    is_secret    boolean     NOT NULL DEFAULT false,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    updated_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.app_config IS
    'Runtime feature flags and configuration. Updated by admins; consumed by Edge Functions and DB RPCs.';

-- RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Admins can read/write everything
DROP POLICY IF EXISTS "Admins read/write app_config" ON public.app_config;
CREATE POLICY "Admins read/write app_config"
    ON public.app_config
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'super_admin')
        )
    );

-- Authenticated users can read non-secret config values
DROP POLICY IF EXISTS "Authenticated users read public config" ON public.app_config;
CREATE POLICY "Authenticated users read public config"
    ON public.app_config
    FOR SELECT
    TO authenticated
    USING (is_secret = false);

-- ── 2. Helper RPC: read a config value ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_app_config(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT value FROM public.app_config WHERE key = p_key;
$$;

COMMENT ON FUNCTION public.get_app_config(text) IS
    'Returns the JSONB value for a given app_config key, or NULL if not found.';

-- Convenience: read a boolean flag (returns false if key missing)
CREATE OR REPLACE FUNCTION public.get_flag(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT value::boolean FROM public.app_config WHERE key = p_key),
        false
    );
$$;

COMMENT ON FUNCTION public.get_flag(text) IS
    'Returns true/false for a boolean feature flag. Returns false when key is absent.';

-- ── 3. Seed V2 rollout flags (idempotent) ────────────────────────────────────

INSERT INTO public.app_config (key, value, description, is_secret) VALUES

-- ── Billing V2 ──────────────────────────────────────────────────────────────
('billing.v2.enabled',
 'false',
 'Master switch: route all new credit deductions through the V2 reserve/settle gateway. When false, all deductions fall back to legacy RPCs.',
 false),

('billing.v2.job_search.enabled',
 'false',
 'Enable V2 billing path for job_search runs specifically.',
 false),

('billing.v2.auto_apply.enabled',
 'false',
 'Enable V2 billing path for auto_apply runs specifically.',
 false),

('billing.v2.ai_chat.enabled',
 'false',
 'Enable V2 billing path for AI chat sessions.',
 false),

('billing.v2.cover_letter.enabled',
 'false',
 'Enable V2 billing path for cover letter generation.',
 false),

('billing.v2.reserve_timeout_minutes',
 '30',
 'Minutes before an unresolved credit hold is automatically expired and released.',
 false),

-- ── Search V2 ───────────────────────────────────────────────────────────────
('search.v2.run_linked_results.enabled',
 'false',
 'When enabled, search results are written to job_search_results (linked to the run ID) instead of raw job rows, and the frontend retrieves by run_id rather than raw_data scope match.',
 false),

('search.v2.scope_normalization.enabled',
 'false',
 'Enable canonical search-scope normalization before writing discovery metadata to raw_data.',
 false),

-- ── Ingestion ────────────────────────────────────────────────────────────────
('ingestion.protect_application_status',
 'true',
 'When true, upserts on the jobs table do NOT overwrite canonical_status for rows where status is already Submitted, Interview, Rejected, Offer, or Archived.',
 false),

('ingestion.write_discovery_scope',
 'false',
 'When true, the process-job-search function writes raw_data.discovery.search_query so that the frontend scope filter can find the results.',
 false),

-- ── Reconciliation ───────────────────────────────────────────────────────────
('reconciliation.auto_refund.enabled',
 'false',
 'When true, the reconciliation job automatically issues refunds for charged-but-invisible search results.',
 false),

('reconciliation.dry_run',
 'true',
 'When true, reconciliation logic logs what it would refund but does not actually modify balances.',
 false)

ON CONFLICT (key) DO UPDATE
    SET value       = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at  = now();

-- ── 4. Grant execute on helpers ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_app_config(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_flag(text)        TO authenticated, service_role;
