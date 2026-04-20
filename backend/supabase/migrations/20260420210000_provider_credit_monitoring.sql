-- Provider-level credit monitoring for Firecrawl and Skyvern.
-- Firecrawl balances are refreshed from the provider API. Skyvern balances are
-- manually configured, then reduced idempotently from completed run step counts.

CREATE TABLE IF NOT EXISTS public.provider_credit_balances (
  provider text PRIMARY KEY,
  display_name text NOT NULL,
  total_credits integer NOT NULL DEFAULT 0 CHECK (total_credits >= 0),
  remaining_credits integer NOT NULL DEFAULT 0 CHECK (remaining_credits >= 0),
  alert_threshold integer NOT NULL DEFAULT 500 CHECK (alert_threshold >= 0),
  alert_email text,
  alert_enabled boolean NOT NULL DEFAULT true,
  last_alert_sent_at timestamptz,
  last_alert_remaining integer,
  last_checked_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_credit_balances_provider_check
    CHECK (provider IN ('firecrawl', 'skyvern'))
);

CREATE TABLE IF NOT EXISTS public.provider_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL REFERENCES public.provider_credit_balances(provider) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount integer NOT NULL,
  balance_before integer,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  total_credits integer,
  external_id text,
  source text NOT NULL DEFAULT 'system',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_credit_transactions_event_type_check
    CHECK (event_type IN ('manual_set', 'snapshot', 'usage', 'adjustment', 'alert'))
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_credit_transactions_provider_external_id_idx
  ON public.provider_credit_transactions(provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_credit_transactions_provider_created_idx
  ON public.provider_credit_transactions(provider, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_provider_credit_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_provider_credit_balances_updated_at
  ON public.provider_credit_balances;

CREATE TRIGGER set_provider_credit_balances_updated_at
  BEFORE UPDATE ON public.provider_credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_provider_credit_updated_at();

INSERT INTO public.provider_credit_balances (provider, display_name, total_credits, remaining_credits, source)
VALUES
  ('firecrawl', 'Firecrawl', 0, 0, 'seed'),
  ('skyvern', 'Skyvern', 0, 0, 'seed')
ON CONFLICT (provider) DO NOTHING;

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
  v_existing public.provider_credit_balances%ROWTYPE;
  v_before integer;
  v_delta integer;
  v_event_type text;
  v_display_name text;
BEGIN
  IF p_provider NOT IN ('firecrawl', 'skyvern') THEN
    RETURN json_build_object('success', false, 'message', 'Unsupported provider');
  END IF;

  IF p_total_credits IS NULL OR p_total_credits < 0 THEN
    RETURN json_build_object('success', false, 'message', 'Total credits must be zero or greater');
  END IF;

  IF p_remaining_credits IS NULL OR p_remaining_credits < 0 THEN
    RETURN json_build_object('success', false, 'message', 'Remaining credits must be zero or greater');
  END IF;

  v_display_name := CASE p_provider
    WHEN 'firecrawl' THEN 'Firecrawl'
    WHEN 'skyvern' THEN 'Skyvern'
    ELSE initcap(p_provider)
  END;

  SELECT * INTO v_existing
  FROM public.provider_credit_balances
  WHERE provider = p_provider
  FOR UPDATE;

  IF FOUND THEN
    v_before := v_existing.remaining_credits;

    UPDATE public.provider_credit_balances
    SET
      display_name = v_display_name,
      total_credits = p_total_credits,
      remaining_credits = p_remaining_credits,
      alert_threshold = COALESCE(p_alert_threshold, alert_threshold),
      alert_email = CASE
        WHEN p_alert_email IS NULL THEN alert_email
        ELSE NULLIF(trim(p_alert_email), '')
      END,
      alert_enabled = COALESCE(p_alert_enabled, alert_enabled),
      last_checked_at = now(),
      source = COALESCE(NULLIF(trim(p_source), ''), source),
      metadata = COALESCE(p_metadata, '{}'::jsonb)
    WHERE provider = p_provider;
  ELSE
    v_before := NULL;

    INSERT INTO public.provider_credit_balances (
      provider,
      display_name,
      total_credits,
      remaining_credits,
      alert_threshold,
      alert_email,
      alert_enabled,
      last_checked_at,
      source,
      metadata
    )
    VALUES (
      p_provider,
      v_display_name,
      p_total_credits,
      p_remaining_credits,
      COALESCE(p_alert_threshold, 500),
      NULLIF(trim(COALESCE(p_alert_email, '')), ''),
      COALESCE(p_alert_enabled, true),
      now(),
      COALESCE(NULLIF(trim(p_source), ''), 'manual'),
      COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  v_delta := CASE
    WHEN v_before IS NULL THEN 0
    ELSE p_remaining_credits - v_before
  END;

  v_event_type := CASE
    WHEN p_source = 'firecrawl_api' THEN 'snapshot'
    ELSE 'manual_set'
  END;

  INSERT INTO public.provider_credit_transactions (
    provider,
    event_type,
    amount,
    balance_before,
    balance_after,
    total_credits,
    source,
    description,
    metadata
  )
  VALUES (
    p_provider,
    v_event_type,
    v_delta,
    v_before,
    p_remaining_credits,
    p_total_credits,
    COALESCE(NULLIF(trim(p_source), ''), 'manual'),
    COALESCE(p_description, v_display_name || ' credit balance updated'),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN json_build_object(
    'success', true,
    'provider', p_provider,
    'total_credits', p_total_credits,
    'remaining_credits', p_remaining_credits,
    'previous_remaining_credits', v_before,
    'delta', v_delta
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_provider_credit_usage(
  p_provider text,
  p_credits_consumed integer,
  p_external_id text DEFAULT NULL,
  p_source text DEFAULT 'system',
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance public.provider_credit_balances%ROWTYPE;
  v_existing_tx public.provider_credit_transactions%ROWTYPE;
  v_before integer;
  v_after integer;
  v_display_name text;
BEGIN
  IF p_provider NOT IN ('firecrawl', 'skyvern') THEN
    RETURN json_build_object('success', false, 'message', 'Unsupported provider');
  END IF;

  IF p_credits_consumed IS NULL OR p_credits_consumed <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Credits consumed must be greater than zero');
  END IF;

  v_display_name := CASE p_provider
    WHEN 'firecrawl' THEN 'Firecrawl'
    WHEN 'skyvern' THEN 'Skyvern'
    ELSE initcap(p_provider)
  END;

  INSERT INTO public.provider_credit_balances (provider, display_name, total_credits, remaining_credits)
  VALUES (p_provider, v_display_name, 0, 0)
  ON CONFLICT (provider) DO NOTHING;

  SELECT * INTO v_balance
  FROM public.provider_credit_balances
  WHERE provider = p_provider
  FOR UPDATE;

  IF p_external_id IS NOT NULL THEN
    SELECT * INTO v_existing_tx
    FROM public.provider_credit_transactions
    WHERE provider = p_provider
      AND external_id = p_external_id
    LIMIT 1;

    IF FOUND THEN
      RETURN json_build_object(
        'success', true,
        'duplicate', true,
        'provider', p_provider,
        'credits_consumed', abs(v_existing_tx.amount),
        'remaining_credits', v_balance.remaining_credits,
        'transaction_id', v_existing_tx.id
      );
    END IF;
  END IF;

  v_before := COALESCE(v_balance.remaining_credits, 0);
  v_after := GREATEST(v_before - p_credits_consumed, 0);

  UPDATE public.provider_credit_balances
  SET
    remaining_credits = v_after,
    last_checked_at = now(),
    source = COALESCE(NULLIF(trim(p_source), ''), 'system'),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_usage_external_id', p_external_id,
      'last_usage_credits', p_credits_consumed,
      'last_usage_at', now()
    )
  WHERE provider = p_provider;

  INSERT INTO public.provider_credit_transactions (
    provider,
    event_type,
    amount,
    balance_before,
    balance_after,
    total_credits,
    external_id,
    source,
    description,
    metadata
  )
  VALUES (
    p_provider,
    'usage',
    -p_credits_consumed,
    v_before,
    v_after,
    v_balance.total_credits,
    NULLIF(trim(COALESCE(p_external_id, '')), ''),
    COALESCE(NULLIF(trim(p_source), ''), 'system'),
    COALESCE(p_description, v_display_name || ' usage'),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_existing_tx;

  RETURN json_build_object(
    'success', true,
    'duplicate', false,
    'provider', p_provider,
    'credits_consumed', p_credits_consumed,
    'previous_remaining_credits', v_before,
    'remaining_credits', v_after,
    'transaction_id', v_existing_tx.id
  );
END;
$$;

ALTER TABLE public.provider_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view provider credit balances"
  ON public.provider_credit_balances;
CREATE POLICY "Admins can view provider credit balances"
  ON public.provider_credit_balances FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage provider credit balances"
  ON public.provider_credit_balances;
CREATE POLICY "Admins can manage provider credit balances"
  ON public.provider_credit_balances FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view provider credit transactions"
  ON public.provider_credit_transactions;
CREATE POLICY "Admins can view provider credit transactions"
  ON public.provider_credit_transactions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage provider credit transactions"
  ON public.provider_credit_transactions;
CREATE POLICY "Admins can manage provider credit transactions"
  ON public.provider_credit_transactions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_credit_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_credit_transactions TO authenticated;
GRANT ALL ON public.provider_credit_balances TO service_role;
GRANT ALL ON public.provider_credit_transactions TO service_role;
REVOKE ALL ON FUNCTION public.set_provider_credit_balance(text, integer, integer, integer, text, boolean, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_provider_credit_balance(text, integer, integer, integer, text, boolean, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.set_provider_credit_balance(text, integer, integer, integer, text, boolean, text, text, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.record_provider_credit_usage(text, integer, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_provider_credit_usage(text, integer, text, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.record_provider_credit_usage(text, integer, text, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_provider_credit_balance(text, integer, integer, integer, text, boolean, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_provider_credit_usage(text, integer, text, text, text, jsonb) TO service_role;
