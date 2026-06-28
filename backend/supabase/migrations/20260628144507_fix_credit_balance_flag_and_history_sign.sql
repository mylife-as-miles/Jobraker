-- Keep credit display aligned with the active billing ledger.
--
-- When billing.v2.enabled is false, current write paths still update the legacy
-- user_credits / credit_transactions tables. The balance RPC must not prefer a
-- stale V2 row in that mode.

CREATE OR REPLACE FUNCTION public.get_v2_credit_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_row record;
    v_v2_enabled boolean := false;
BEGIN
    v_v2_enabled := COALESCE(public.get_flag('billing.v2.enabled'), false);

    IF v_v2_enabled THEN
        SELECT available, reserved, lifetime_earned, lifetime_spent, updated_at
        INTO v_row
        FROM public.credit_balances
        WHERE user_id = p_user_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'available',       COALESCE(v_row.available, 0),
                'reserved',        COALESCE(v_row.reserved, 0),
                'total',           COALESCE(v_row.available, 0) + COALESCE(v_row.reserved, 0),
                'lifetime_earned', COALESCE(v_row.lifetime_earned, 0),
                'lifetime_spent',  COALESCE(v_row.lifetime_spent, 0),
                'source',          'v2',
                'updated_at',      v_row.updated_at
            );
        END IF;
    END IF;

    SELECT balance, lifetime_earned, lifetime_spent, updated_at
    INTO v_row
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'available',       COALESCE(v_row.balance, 0),
            'reserved',        0,
            'total',           COALESCE(v_row.balance, 0),
            'lifetime_earned', COALESCE(v_row.lifetime_earned, 0),
            'lifetime_spent',  COALESCE(v_row.lifetime_spent, 0),
            'source',          'legacy',
            'updated_at',      v_row.updated_at
        );
    END IF;

    -- If legacy is missing but a V2 row exists, still return it as fallback.
    SELECT available, reserved, lifetime_earned, lifetime_spent, updated_at
    INTO v_row
    FROM public.credit_balances
    WHERE user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'available',       COALESCE(v_row.available, 0),
            'reserved',        COALESCE(v_row.reserved, 0),
            'total',           COALESCE(v_row.available, 0) + COALESCE(v_row.reserved, 0),
            'lifetime_earned', COALESCE(v_row.lifetime_earned, 0),
            'lifetime_spent',  COALESCE(v_row.lifetime_spent, 0),
            'source',          'v2_fallback',
            'updated_at',      v_row.updated_at
        );
    END IF;

    RETURN jsonb_build_object(
        'available',       0,
        'reserved',        0,
        'total',           0,
        'lifetime_earned', 0,
        'lifetime_spent',  0,
        'source',          'none',
        'updated_at',      null
    );
END;
$$;

COMMENT ON FUNCTION public.get_v2_credit_balance(uuid) IS
  'Returns the active credit balance. Uses V2 credit_balances only when billing.v2.enabled is true; otherwise returns legacy user_credits so the UI matches active write paths.';

CREATE OR REPLACE VIEW public.v_credit_history AS
 SELECT le.id,
    le.user_id,
    le.entry_type AS tx_type,
    le.amount,
    le.available_before AS balance_before,
    le.available_after AS balance_after,
    le.description,
    le.reference_type,
    le.reference_id,
    le.agent_run_id,
    le.hold_id,
    le.metadata,
    le.created_at,
    'v2'::text AS source,
    le.legacy_tx_id AS linked_legacy_id
   FROM public.credit_ledger_entries le
UNION ALL
 SELECT ct.id,
    ct.user_id,
    COALESCE(ct.transaction_type, 'unknown'::text) AS tx_type,
    ct.amount,
    NULL::integer AS balance_before,
    ct.balance_after,
    ct.description,
    ct.reference_type,
    ct.reference_id,
    ct.agent_run_id,
    NULL::uuid AS hold_id,
    COALESCE(ct.metadata, '{}'::jsonb) AS metadata,
    ct.created_at,
    'legacy'::text AS source,
    NULL::uuid AS linked_legacy_id
   FROM public.credit_transactions ct
  WHERE NOT (EXISTS (
    SELECT 1
    FROM public.credit_ledger_entries le2
    WHERE le2.legacy_tx_id = ct.id
  ));

COMMENT ON VIEW public.v_credit_history IS
  'Merged V2/legacy credit history. Legacy amount signs are preserved so debits render as negative values.';
