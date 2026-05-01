-- Ensure one-time credit pack purchases create visible transaction history rows.
-- Production deployments have used both `type` and `transaction_type`; the
-- billing UI reads `transaction_type`, so prefer it when present.

CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT,
    p_reference_type TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance INTEGER;
    v_previous_balance INTEGER;
    v_has_updated_at BOOLEAN;
    v_has_lifetime_earned BOOLEAN;
    v_has_total_earned BOOLEAN;
    v_has_transaction_type BOOLEAN;
    v_has_type BOOLEAN;
    v_has_balance_before BOOLEAN;
    v_has_metadata BOOLEAN;
    v_transaction_kind TEXT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Amount must be greater than 0'
        );
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_credits'
          AND column_name = 'updated_at'
    ) INTO v_has_updated_at;

    IF v_has_updated_at THEN
        INSERT INTO public.user_credits (user_id, balance)
        VALUES (p_user_id, p_amount)
        ON CONFLICT (user_id) DO UPDATE
        SET
            balance = user_credits.balance + EXCLUDED.balance,
            updated_at = NOW()
        RETURNING balance INTO v_new_balance;
    ELSE
        INSERT INTO public.user_credits (user_id, balance)
        VALUES (p_user_id, p_amount)
        ON CONFLICT (user_id) DO UPDATE
        SET balance = user_credits.balance + EXCLUDED.balance
        RETURNING balance INTO v_new_balance;
    END IF;

    v_previous_balance := v_new_balance - p_amount;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_credits'
          AND column_name = 'lifetime_earned'
    ) INTO v_has_lifetime_earned;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_credits'
          AND column_name = 'total_earned'
    ) INTO v_has_total_earned;

    IF v_has_lifetime_earned THEN
        UPDATE public.user_credits
        SET lifetime_earned = COALESCE(lifetime_earned, 0) + p_amount
        WHERE user_id = p_user_id;
    END IF;

    IF v_has_total_earned THEN
        UPDATE public.user_credits
        SET total_earned = COALESCE(total_earned, 0) + p_amount
        WHERE user_id = p_user_id;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'transaction_type'
    ) INTO v_has_transaction_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'type'
    ) INTO v_has_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'metadata'
    ) INTO v_has_metadata;

    v_transaction_kind := CASE
        WHEN p_reference_type = 'order' THEN 'refill'
        ELSE 'bonus'
    END;

    IF v_has_transaction_type THEN
        IF v_has_balance_before AND v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                v_transaction_kind,
                p_amount,
                v_previous_balance,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id,
                p_metadata
            );
        ELSIF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                description,
                reference_type,
                reference_id
            ) VALUES (
                p_user_id,
                v_transaction_kind,
                p_amount,
                v_previous_balance,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id
            );
        ELSIF v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id,
                transaction_type,
                amount,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                v_transaction_kind,
                p_amount,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id,
                p_metadata
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id,
                transaction_type,
                amount,
                balance_after,
                description,
                reference_type,
                reference_id
            ) VALUES (
                p_user_id,
                v_transaction_kind,
                p_amount,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id
            );
        END IF;
    ELSIF v_has_type THEN
        IF v_has_balance_before AND v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_before,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                'earned',
                p_amount,
                v_previous_balance,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id,
                p_metadata
            );
        ELSIF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_before,
                balance_after,
                description,
                reference_type,
                reference_id
            ) VALUES (
                p_user_id,
                'earned',
                p_amount,
                v_previous_balance,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id
            );
        ELSIF v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_after,
                description,
                reference_type,
                reference_id,
                metadata
            ) VALUES (
                p_user_id,
                'earned',
                p_amount,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id,
                p_metadata
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id,
                type,
                amount,
                balance_after,
                description,
                reference_type,
                reference_id
            ) VALUES (
                p_user_id,
                'earned',
                p_amount,
                v_new_balance,
                p_description,
                p_reference_type,
                p_reference_id
            );
        END IF;
    ELSE
        RETURN json_build_object(
            'success', false,
            'message', 'credit_transactions has no supported transaction type column'
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Credits added successfully',
        'previous_balance', v_previous_balance,
        'new_balance', v_new_balance
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Error adding credits: ' || SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT, UUID, JSONB) TO service_role;

DO $$
DECLARE
    v_has_transaction_type BOOLEAN;
    v_has_type BOOLEAN;
    v_has_balance_before BOOLEAN;
    v_has_metadata BOOLEAN;
    v_kind_column TEXT;
    v_kind_value TEXT;
    v_columns TEXT;
    v_select TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'orders'
    ) THEN
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'transaction_type'
    ) INTO v_has_transaction_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'type'
    ) INTO v_has_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'metadata'
    ) INTO v_has_metadata;

    IF v_has_transaction_type THEN
        v_kind_column := 'transaction_type';
        v_kind_value := 'refill';
    ELSIF v_has_type THEN
        v_kind_column := 'type';
        v_kind_value := 'earned';
    ELSE
        RETURN;
    END IF;

    v_columns := format('user_id, %I, amount', v_kind_column);
    v_select := format(
        'o.user_id, %L, COALESCE(NULLIF(o.total_credits_paid_for, 0), (COALESCE((o.metadata->>''credits'')::int, 0) + COALESCE((o.metadata->>''bonus_credits'')::int, 0)))',
        v_kind_value
    );

    IF v_has_balance_before THEN
        v_columns := v_columns || ', balance_before';
        v_select := v_select || ', GREATEST(COALESCE(uc.balance, 0) - COALESCE(NULLIF(o.total_credits_paid_for, 0), (COALESCE((o.metadata->>''credits'')::int, 0) + COALESCE((o.metadata->>''bonus_credits'')::int, 0))), 0)';
    END IF;

    v_columns := v_columns || ', balance_after, description, reference_type, reference_id';
    v_select := v_select || ', COALESCE(uc.balance, 0), ''Purchased '' || COALESCE(o.metadata->>''pack_name'', ''credit pack''), ''order'', o.id';

    IF v_has_metadata THEN
        v_columns := v_columns || ', metadata';
        v_select := v_select || ', jsonb_build_object(''order_id'', o.id, ''paystack_ref'', o.tx_id, ''sku'', o.metadata->>''sku'', ''backfilled'', true)';
    END IF;

    EXECUTE format(
        'INSERT INTO public.credit_transactions (%s)
         SELECT %s
         FROM public.orders o
         LEFT JOIN public.user_credits uc ON uc.user_id = o.user_id
         WHERE o.plan_type = ''credit_pack''
           AND o.is_success = true
           AND o.user_id IS NOT NULL
           AND COALESCE(NULLIF(o.total_credits_paid_for, 0), (COALESCE((o.metadata->>''credits'')::int, 0) + COALESCE((o.metadata->>''bonus_credits'')::int, 0))) > 0
           AND NOT EXISTS (
             SELECT 1
             FROM public.credit_transactions ct
             WHERE ct.user_id = o.user_id
               AND ct.reference_type = ''order''
               AND ct.reference_id = o.id
           )',
        v_columns,
        v_select
    );
END $$;
