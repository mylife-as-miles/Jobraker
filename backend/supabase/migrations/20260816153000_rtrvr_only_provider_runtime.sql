-- RTRVR is the sole active external web provider. Retain historical provider
-- ledger rows for auditability, but only create/update the RTRVR balance.

ALTER TABLE public.provider_credit_balances
  DROP CONSTRAINT IF EXISTS provider_credit_balances_provider_check;

ALTER TABLE public.provider_credit_balances
  ADD CONSTRAINT provider_credit_balances_provider_check
  CHECK (provider IN ('firecrawl', 'skyvern', 'rtrvr'));

INSERT INTO public.provider_credit_balances (
  provider, display_name, total_credits, remaining_credits, source, metadata
)
VALUES ('rtrvr', 'RTRVR', 0, 0, 'seed', '{"active": true}'::jsonb)
ON CONFLICT (provider) DO UPDATE
SET display_name = 'RTRVR', metadata = provider_credit_balances.metadata || '{"active": true}'::jsonb;

CREATE OR REPLACE FUNCTION public.set_provider_credit_balance(
  p_provider text,
  p_total_credits integer,
  p_remaining_credits integer,
  p_alert_threshold integer DEFAULT NULL,
  p_alert_email text DEFAULT NULL,
  p_alert_enabled boolean DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before integer;
BEGIN
  IF p_provider <> 'rtrvr' THEN
    RETURN json_build_object('success', false, 'message', 'RTRVR is the only active provider');
  END IF;
  IF p_total_credits < 0 OR p_remaining_credits < 0 THEN
    RETURN json_build_object('success', false, 'message', 'Credit values must be zero or greater');
  END IF;

  SELECT remaining_credits INTO v_before
  FROM public.provider_credit_balances WHERE provider = 'rtrvr' FOR UPDATE;

  INSERT INTO public.provider_credit_balances (
    provider, display_name, total_credits, remaining_credits, alert_threshold,
    alert_email, alert_enabled, last_checked_at, source, metadata
  ) VALUES (
    'rtrvr', 'RTRVR', p_total_credits, p_remaining_credits,
    COALESCE(p_alert_threshold, 500), NULLIF(trim(COALESCE(p_alert_email, '')), ''),
    COALESCE(p_alert_enabled, true), now(), COALESCE(NULLIF(trim(p_source), ''), 'manual'),
    COALESCE(p_metadata, '{}'::jsonb)
  ) ON CONFLICT (provider) DO UPDATE SET
    total_credits = EXCLUDED.total_credits,
    remaining_credits = EXCLUDED.remaining_credits,
    alert_threshold = COALESCE(p_alert_threshold, public.provider_credit_balances.alert_threshold),
    alert_email = CASE WHEN p_alert_email IS NULL THEN public.provider_credit_balances.alert_email ELSE EXCLUDED.alert_email END,
    alert_enabled = COALESCE(p_alert_enabled, public.provider_credit_balances.alert_enabled),
    last_checked_at = now(), source = EXCLUDED.source, metadata = EXCLUDED.metadata;

  INSERT INTO public.provider_credit_transactions (
    provider, event_type, amount, balance_before, balance_after, total_credits,
    source, description, metadata
  ) VALUES (
    'rtrvr', 'manual_set', p_remaining_credits - COALESCE(v_before, p_remaining_credits),
    v_before, p_remaining_credits, p_total_credits,
    COALESCE(NULLIF(trim(p_source), ''), 'manual'),
    COALESCE(p_description, 'RTRVR credit balance updated'), COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN json_build_object(
    'success', true, 'provider', 'rtrvr', 'total_credits', p_total_credits,
    'remaining_credits', p_remaining_credits, 'previous_remaining_credits', v_before
  );
END;
$$;

INSERT INTO public.external_provider_credit_rates (
  provider, provider_plan_key, operation_class, provider_unit_type,
  allocated_cost_nanos_per_unit, safety_multiplier, minimum_user_credits,
  reservation_multiplier, source, metadata
) VALUES
  ('rtrvr', 'production', 'run', 'credits', 10000000, 1.20, 1, 1.25, 'production_account', '{"active": true, "covers": "job_discovery_and_automation"}'::jsonb),
  ('rtrvr', 'production', 'scrape', 'credits', 10000000, 1.20, 1, 1.25, 'production_account', '{"active": true}'::jsonb),
  ('rtrvr', 'production', 'act', 'credits', 10000000, 1.20, 1, 1.25, 'production_account', '{"active": true}'::jsonb)
ON CONFLICT DO NOTHING;
