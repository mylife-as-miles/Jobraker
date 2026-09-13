-- Migration: 20260912100000_harden_promotion_redemptions_and_idempotency.sql
-- Financial & Database Integrity Hardening for Personalized Promotion Engine V1:
-- 1. Strongly-typed UUID foreign keys referencing public.orders(id) with ON DELETE rules.
-- 2. Separation of internal order_id (uuid) from payment provider reference (text).
-- 3. Non-expiring reservation invariant: local TTL does NOT release reservation unless bound order is in trusted terminal state.
-- 4. Reservation release restricted strictly to service_role (revoked from PUBLIC, anon, authenticated).
-- 5. Stateful fulfillment records (pending, completed, failed, attempt_count, started_at, completed_at, last_error).
-- 6. Atomic PostgreSQL RPCs for crash-safe transactional fulfillment and V2 credit ledger integration.
-- 7. Revocation of direct client INSERT on promotion_events.

-- 1. Alter promotion_assignments: ensure bound_order_id is UUID with FK to public.orders(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promotion_assignments' AND column_name = 'bound_order_id'
  ) THEN
    ALTER TABLE public.promotion_assignments
      ALTER COLUMN bound_order_id TYPE uuid USING (
        CASE
          WHEN bound_order_id::text ~ '^[0-9a-fA-F-]{36}$' THEN bound_order_id::uuid
          ELSE NULL
        END
      );
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_promotion_assignments_bound_order'
    ) THEN
      ALTER TABLE public.promotion_assignments
        ADD CONSTRAINT fk_promotion_assignments_bound_order
        FOREIGN KEY (bound_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
    END IF;
  ELSE
    ALTER TABLE public.promotion_assignments
      ADD COLUMN bound_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Normalized Promotion Redemptions Table
CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.promotion_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider_reference text,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'converted', 'released', 'cancelled')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: at most ONE active reservation or conversion per promotion assignment
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_redemptions_active_assignment
  ON public.promotion_redemptions (assignment_id)
  WHERE status IN ('reserved', 'converted');

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_user_order
  ON public.promotion_redemptions (user_id, order_id);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_expires
  ON public.promotion_redemptions (expires_at)
  WHERE status = 'reserved';

-- 3. Promotion Fulfillment Records Table (Stateful Webhook Idempotency & Crash Safety)
CREATE TABLE IF NOT EXISTS public.promotion_fulfillment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  assignment_id uuid NOT NULL REFERENCES public.promotion_assignments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('bonus_credits', 'bonus_auto_apply_runs', 'converted_event')),
  quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text,
  attempt_count integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_fulfillment_assignment
  ON public.promotion_fulfillment_records (assignment_id, fulfillment_type);

CREATE INDEX IF NOT EXISTS idx_promotion_fulfillment_status
  ON public.promotion_fulfillment_records (status);

-- 4. Row Level Security and Strict Permissions
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_fulfillment_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.promotion_redemptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.promotion_redemptions TO authenticated;
GRANT ALL ON public.promotion_redemptions TO service_role;

DROP POLICY IF EXISTS "Users can view own redemptions" ON public.promotion_redemptions;
CREATE POLICY "Users can view own redemptions"
  ON public.promotion_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.promotion_fulfillment_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promotion_fulfillment_records TO service_role;

-- Revoke direct client INSERT on promotion_events (Enforces authoritative edge ingestion)
DROP POLICY IF EXISTS "Users can insert low-trust interaction promotion events" ON public.promotion_events;
DROP POLICY IF EXISTS "Users can insert their own promotion events" ON public.promotion_events;
REVOKE INSERT ON public.promotion_events FROM authenticated;

-- 5. Atomic RPC: reserve_promotion_assignment
CREATE OR REPLACE FUNCTION public.reserve_promotion_assignment(
  p_assignment_id uuid,
  p_user_id uuid,
  p_order_id uuid,
  p_provider_reference text DEFAULT NULL,
  p_ttl_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment record;
  v_new_order record;
  v_existing_redemption record;
  v_bound_order record;
  v_bound_order_status text;
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz := v_now + (GREATEST(5, LEAST(120, COALESCE(p_ttl_minutes, 30))) || ' minutes')::interval;
BEGIN
  -- 1. Validate order existence and user ownership (Foreign key check in function)
  SELECT id, user_id, is_success, metadata INTO v_new_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_new_order.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_user_mismatch');
  END IF;

  -- 2. Lock assignment row for update to serialize concurrent attempts
  SELECT * INTO v_assignment
  FROM public.promotion_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'assignment_not_found');
  END IF;

  IF v_assignment.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_mismatch');
  END IF;

  IF v_assignment.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'assignment_not_active', 'status', v_assignment.status);
  END IF;

  IF v_assignment.expires_at IS NOT NULL AND v_assignment.expires_at <= v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'assignment_expired');
  END IF;

  -- 3. Check existing redemptions for this assignment
  SELECT * INTO v_existing_redemption
  FROM public.promotion_redemptions
  WHERE assignment_id = p_assignment_id
    AND status IN ('reserved', 'converted')
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_redemption.status = 'converted' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'already_converted',
        'converted_order_id', v_existing_redemption.order_id
      );
    END IF;

    -- If reserved by the SAME order -> allowed (idempotent retry)
    IF v_existing_redemption.order_id = p_order_id THEN
      UPDATE public.promotion_redemptions
      SET expires_at = v_expires_at,
          provider_reference = COALESCE(p_provider_reference, provider_reference),
          updated_at = v_now
      WHERE id = v_existing_redemption.id;

      UPDATE public.promotion_assignments
      SET bound_order_id = p_order_id, updated_at = v_now
      WHERE id = p_assignment_id;

      RETURN jsonb_build_object('success', true, 'reused', true, 'redemption_id', v_existing_redemption.id);
    END IF;

    -- If reserved by a DIFFERENT order:
    SELECT is_success, metadata INTO v_bound_order
    FROM public.orders
    WHERE id = v_existing_redemption.order_id;

    IF FOUND THEN
      IF v_bound_order.is_success = true THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'already_converted',
          'bound_order_id', v_existing_redemption.order_id
        );
      END IF;

      v_bound_order_status := COALESCE(v_bound_order.metadata->>'status', 'pending');

      -- ONLY release if the bound order is in a trusted terminal failed/cancelled state
      IF v_bound_order_status IN ('failed', 'cancelled', 'expired', 'abandoned') THEN
        UPDATE public.promotion_redemptions
        SET status = 'released', released_at = v_now, updated_at = v_now
        WHERE id = v_existing_redemption.id;
      ELSE
        -- REQUIRED INVARIANT:
        -- Even if local TTL expired (v_existing_redemption.expires_at <= v_now),
        -- if the bound order payment session is still payable, the assignment remains unavailable!
        RETURN jsonb_build_object(
          'success', false,
          'error', 'already_reserved_by_other_order',
          'bound_order_id', v_existing_redemption.order_id,
          'order_status', v_bound_order_status
        );
      END IF;
    ELSE
      -- Bound order row not found in orders table; release stale reservation
      UPDATE public.promotion_redemptions
      SET status = 'released', released_at = v_now, updated_at = v_now
      WHERE id = v_existing_redemption.id;
    END IF;
  END IF;

  -- 4. Insert new reservation
  INSERT INTO public.promotion_redemptions (
    assignment_id,
    user_id,
    order_id,
    provider_reference,
    status,
    reserved_at,
    expires_at
  ) VALUES (
    p_assignment_id,
    p_user_id,
    p_order_id,
    p_provider_reference,
    'reserved',
    v_now,
    v_expires_at
  );

  UPDATE public.promotion_assignments
  SET bound_order_id = p_order_id, updated_at = v_now
  WHERE id = p_assignment_id;

  RETURN jsonb_build_object('success', true, 'reused', false);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'concurrency_conflict');
END;
$$;

-- 6. Atomic RPC: release_promotion_reservation
CREATE OR REPLACE FUNCTION public.release_promotion_reservation(
  p_assignment_id uuid,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_rows_updated integer;
BEGIN
  UPDATE public.promotion_redemptions
  SET status = 'released', released_at = v_now, updated_at = v_now
  WHERE assignment_id = p_assignment_id
    AND order_id = p_order_id
    AND status = 'reserved';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    UPDATE public.promotion_assignments
    SET bound_order_id = NULL, updated_at = v_now
    WHERE id = p_assignment_id
      AND bound_order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'released', true);
  END IF;

  RETURN jsonb_build_object('success', true, 'released', false);
END;
$$;

-- 7. Atomic RPC: fulfill_promotion_bonus_credits
CREATE OR REPLACE FUNCTION public.fulfill_promotion_bonus_credits(
  p_idempotency_key text,
  p_assignment_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_bonus_credits integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record record;
  v_add_res json;
  v_now timestamptz := clock_timestamp();
  v_bal_before integer;
  v_bal_after integer;
BEGIN
  IF p_bonus_credits <= 0 THEN
    RETURN jsonb_build_object('success', true, 'status', 'noop', 'credits_granted', 0);
  END IF;

  -- 1. Row-lock or create stateful fulfillment record
  SELECT * INTO v_record
  FROM public.promotion_fulfillment_records
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_record.status = 'completed' THEN
      RETURN jsonb_build_object('success', true, 'status', 'already_completed', 'credits_granted', v_record.quantity);
    END IF;

    UPDATE public.promotion_fulfillment_records
    SET attempt_count = attempt_count + 1,
        status = 'pending',
        updated_at = v_now
    WHERE id = v_record.id;
  ELSE
    INSERT INTO public.promotion_fulfillment_records (
      idempotency_key,
      assignment_id,
      order_id,
      user_id,
      fulfillment_type,
      quantity,
      status,
      started_at,
      attempt_count,
      metadata
    ) VALUES (
      p_idempotency_key,
      p_assignment_id,
      p_order_id,
      p_user_id,
      'bonus_credits',
      p_bonus_credits,
      'pending',
      v_now,
      1,
      p_metadata
    );
  END IF;

  -- 2. Check if V2 credit ledger already recorded this key
  IF EXISTS (
    SELECT 1 FROM public.credit_ledger_entries
    WHERE idempotency_key = p_idempotency_key
  ) THEN
    UPDATE public.promotion_fulfillment_records
    SET status = 'completed', completed_at = v_now, updated_at = v_now
    WHERE idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object('success', true, 'status', 'already_completed', 'credits_granted', p_bonus_credits);
  END IF;

  -- 3. Execute legacy balance addition (user_credits + credit_transactions)
  v_add_res := public.add_credits(
    p_user_id := p_user_id,
    p_amount := p_bonus_credits,
    p_description := 'Promotional bonus credits',
    p_reference_type := 'promotion_bonus',
    p_reference_id := p_order_id,
    p_metadata := p_metadata || jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'promotion_assignment_id', p_assignment_id,
      'order_id', p_order_id
    )
  );

  IF (v_add_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'add_credits failed: %', (v_add_res->>'message');
  END IF;

  -- 4. Dual-write to V2 credit_balances and credit_ledger_entries
  INSERT INTO public.credit_balances (user_id, available, reserved, lifetime_earned)
  VALUES (p_user_id, p_bonus_credits, 0, p_bonus_credits)
  ON CONFLICT (user_id) DO UPDATE
  SET available = public.credit_balances.available + p_bonus_credits,
      lifetime_earned = public.credit_balances.lifetime_earned + p_bonus_credits,
      updated_at = v_now
  RETURNING available INTO v_bal_after;

  v_bal_before := v_bal_after - p_bonus_credits;

  INSERT INTO public.credit_ledger_entries (
    user_id,
    entry_type,
    amount,
    available_before,
    available_after,
    reserved_before,
    reserved_after,
    idempotency_key,
    description,
    reference_type,
    reference_id,
    metadata
  ) VALUES (
    p_user_id,
    'bonus',
    p_bonus_credits,
    v_bal_before,
    v_bal_after,
    0,
    0,
    p_idempotency_key,
    'Promotional bonus credits',
    'promotion_bonus',
    p_order_id,
    p_metadata
  );

  -- 5. Mark fulfillment record completed
  UPDATE public.promotion_fulfillment_records
  SET status = 'completed',
      completed_at = v_now,
      updated_at = v_now,
      last_error = NULL
  WHERE idempotency_key = p_idempotency_key;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'credits_granted', p_bonus_credits,
    'new_balance', (v_add_res->>'new_balance')::integer
  );
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.promotion_fulfillment_records
    SET status = 'failed',
        last_error = SQLERRM,
        updated_at = v_now
    WHERE idempotency_key = p_idempotency_key;
    RAISE;
END;
$$;

-- 8. Atomic RPC: fulfill_promotion_bonus_runs
CREATE OR REPLACE FUNCTION public.fulfill_promotion_bonus_runs(
  p_idempotency_key text,
  p_assignment_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_bonus_runs integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record record;
  v_now timestamptz := clock_timestamp();
  v_period_start timestamptz := v_now;
  v_period_end timestamptz := v_now + interval '90 days';
  v_existing_quota record;
  v_existing_order_ids jsonb;
  v_next_order_ids jsonb;
BEGIN
  IF p_bonus_runs <= 0 THEN
    RETURN jsonb_build_object('success', true, 'status', 'noop', 'runs_granted', 0);
  END IF;

  -- 1. Row-lock or create stateful fulfillment record
  SELECT * INTO v_record
  FROM public.promotion_fulfillment_records
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_record.status = 'completed' THEN
      RETURN jsonb_build_object('success', true, 'status', 'already_completed', 'runs_granted', v_record.quantity);
    END IF;

    UPDATE public.promotion_fulfillment_records
    SET attempt_count = attempt_count + 1,
        status = 'pending',
        updated_at = v_now
    WHERE id = v_record.id;
  ELSE
    INSERT INTO public.promotion_fulfillment_records (
      idempotency_key,
      assignment_id,
      order_id,
      user_id,
      fulfillment_type,
      quantity,
      status,
      started_at,
      attempt_count,
      metadata
    ) VALUES (
      p_idempotency_key,
      p_assignment_id,
      p_order_id,
      p_user_id,
      'bonus_auto_apply_runs',
      p_bonus_runs,
      'pending',
      v_now,
      1,
      p_metadata
    );
  END IF;

  -- 2. Fetch active promotion quota row
  SELECT * INTO v_existing_quota
  FROM public.user_feature_quotas
  WHERE user_id = p_user_id
    AND feature_key = 'auto_apply'
    AND source = 'promotion'
    AND period_end >= v_period_start
  ORDER BY period_end DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_existing_order_ids := COALESCE(v_existing_quota.metadata->'order_ids', '[]'::jsonb);
    IF v_existing_order_ids @> to_jsonb(p_order_id::text) THEN
      UPDATE public.promotion_fulfillment_records
      SET status = 'completed', completed_at = v_now, updated_at = v_now
      WHERE idempotency_key = p_idempotency_key;

      RETURN jsonb_build_object('success', true, 'status', 'already_completed', 'runs_granted', p_bonus_runs);
    END IF;

    v_next_order_ids := v_existing_order_ids || to_jsonb(p_order_id::text);

    UPDATE public.user_feature_quotas
    SET included_quantity = included_quantity + p_bonus_runs,
        updated_at = v_now,
        metadata = v_existing_quota.metadata || jsonb_build_object(
          'order_ids', v_next_order_ids,
          'last_order_id', p_order_id,
          'promotion_assignment_id', p_assignment_id
        )
    WHERE id = v_existing_quota.id;
  ELSE
    v_next_order_ids := jsonb_build_array(p_order_id::text);

    INSERT INTO public.user_feature_quotas (
      user_id,
      feature_key,
      source,
      period_start,
      period_end,
      included_quantity,
      used_quantity,
      metadata
    ) VALUES (
      p_user_id,
      'auto_apply',
      'promotion',
      v_period_start,
      v_period_end,
      p_bonus_runs,
      0,
      jsonb_build_object(
        'order_ids', v_next_order_ids,
        'last_order_id', p_order_id,
        'promotion_assignment_id', p_assignment_id
      )
    );
  END IF;

  -- 3. Mark fulfillment record completed
  UPDATE public.promotion_fulfillment_records
  SET status = 'completed',
      completed_at = v_now,
      updated_at = v_now,
      last_error = NULL
  WHERE idempotency_key = p_idempotency_key;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'runs_granted', p_bonus_runs
  );
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.promotion_fulfillment_records
    SET status = 'failed',
        last_error = SQLERRM,
        updated_at = v_now
    WHERE idempotency_key = p_idempotency_key;
    RAISE;
END;
$$;

-- 9. Atomic RPC: record_promotion_converted_event
CREATE OR REPLACE FUNCTION public.record_promotion_converted_event(
  p_idempotency_key text,
  p_assignment_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_campaign_id text,
  p_placement text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record record;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_record
  FROM public.promotion_fulfillment_records
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND AND v_record.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_completed');
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.promotion_fulfillment_records (
      idempotency_key,
      assignment_id,
      order_id,
      user_id,
      fulfillment_type,
      quantity,
      status,
      started_at,
      metadata
    ) VALUES (
      p_idempotency_key,
      p_assignment_id,
      p_order_id,
      p_user_id,
      'converted_event',
      1,
      'pending',
      v_now,
      p_metadata
    );
  END IF;

  -- Insert conversion event
  INSERT INTO public.promotion_events (
    assignment_id,
    user_id,
    campaign_id,
    event_type,
    placement,
    metadata
  ) VALUES (
    p_assignment_id,
    p_user_id,
    p_campaign_id,
    'converted',
    p_placement,
    p_metadata || jsonb_build_object('idempotency_key', p_idempotency_key, 'order_id', p_order_id)
  );

  UPDATE public.promotion_fulfillment_records
  SET status = 'completed', completed_at = v_now, updated_at = v_now, last_error = NULL
  WHERE idempotency_key = p_idempotency_key;

  RETURN jsonb_build_object('success', true, 'status', 'completed');
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.promotion_fulfillment_records
    SET status = 'failed', last_error = SQLERRM, updated_at = v_now
    WHERE idempotency_key = p_idempotency_key;
    RAISE;
END;
$$;

-- 10. Strict Execution Grants: strictly restricted to service_role
REVOKE EXECUTE ON FUNCTION public.reserve_promotion_assignment(uuid, uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_promotion_reservation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fulfill_promotion_bonus_credits(text, uuid, uuid, uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fulfill_promotion_bonus_runs(text, uuid, uuid, uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_promotion_converted_event(text, uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_promotion_assignment(uuid, uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_promotion_reservation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_promotion_bonus_credits(text, uuid, uuid, uuid, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_promotion_bonus_runs(text, uuid, uuid, uuid, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_promotion_converted_event(text, uuid, uuid, uuid, text, text, jsonb) TO service_role;
