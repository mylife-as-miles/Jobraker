CREATE OR REPLACE FUNCTION public.refund_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT,
    p_reference_type TEXT DEFAULT 'refund',
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
    v_refund_key TEXT;
    v_has_updated_at BOOLEAN;
    v_has_total_consumed BOOLEAN;
    v_has_lifetime_spent BOOLEAN;
    v_has_transaction_type BOOLEAN;
    v_has_type BOOLEAN;
    v_has_balance_before BOOLEAN;
    v_has_metadata BOOLEAN;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'reason', 'invalid_amount', 'message', 'Amount must be greater than 0');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'metadata'
    ) INTO v_has_metadata;

    v_refund_key := NULLIF(p_metadata->>'refund_key', '');
    IF v_refund_key IS NOT NULL AND v_has_metadata THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.credit_transactions
            WHERE user_id = p_user_id
              AND reference_type = COALESCE(p_reference_type, 'refund')
              AND (
                (p_reference_id IS NOT NULL AND reference_id = p_reference_id)
                OR (metadata->>'refund_key') = v_refund_key
              )
        ) INTO v_has_metadata;

        IF v_has_metadata THEN
            SELECT balance INTO v_new_balance
            FROM public.user_credits
            WHERE user_id = p_user_id;

            RETURN json_build_object(
                'success', true,
                'idempotent', true,
                'message', 'Refund already recorded',
                'new_balance', COALESCE(v_new_balance, 0)
            );
        END IF;
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
        SET balance = user_credits.balance + EXCLUDED.balance,
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
          AND column_name = 'total_consumed'
    ) INTO v_has_total_consumed;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_credits'
          AND column_name = 'lifetime_spent'
    ) INTO v_has_lifetime_spent;

    IF v_has_total_consumed THEN
        UPDATE public.user_credits
        SET total_consumed = GREATEST(COALESCE(total_consumed, 0) - p_amount, 0)
        WHERE user_id = p_user_id;
    END IF;

    IF v_has_lifetime_spent THEN
        UPDATE public.user_credits
        SET lifetime_spent = GREATEST(COALESCE(lifetime_spent, 0) - p_amount, 0)
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

    IF v_has_transaction_type THEN
        IF v_has_balance_before AND v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id, transaction_type, amount, balance_before, balance_after,
                description, reference_type, reference_id, metadata
            ) VALUES (
                p_user_id, 'refund', p_amount, v_previous_balance, v_new_balance,
                p_description, COALESCE(p_reference_type, 'refund'), p_reference_id, p_metadata
            );
        ELSIF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id, transaction_type, amount, balance_before, balance_after,
                description, reference_type, reference_id
            ) VALUES (
                p_user_id, 'refund', p_amount, v_previous_balance, v_new_balance,
                p_description, COALESCE(p_reference_type, 'refund'), p_reference_id
            );
        ELSIF v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id, transaction_type, amount, balance_after, description,
                reference_type, reference_id, metadata
            ) VALUES (
                p_user_id, 'refund', p_amount, v_new_balance, p_description,
                COALESCE(p_reference_type, 'refund'), p_reference_id, p_metadata
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id, transaction_type, amount, balance_after, description,
                reference_type, reference_id
            ) VALUES (
                p_user_id, 'refund', p_amount, v_new_balance, p_description,
                COALESCE(p_reference_type, 'refund'), p_reference_id
            );
        END IF;
    ELSIF v_has_type THEN
        IF v_has_balance_before AND v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id, type, amount, balance_before, balance_after,
                description, reference_type, reference_id, metadata
            ) VALUES (
                p_user_id, 'refunded', p_amount, v_previous_balance, v_new_balance,
                p_description, COALESCE(p_reference_type, 'refund'), p_reference_id, p_metadata
            );
        ELSIF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id, type, amount, balance_before, balance_after,
                description, reference_type, reference_id
            ) VALUES (
                p_user_id, 'refunded', p_amount, v_previous_balance, v_new_balance,
                p_description, COALESCE(p_reference_type, 'refund'), p_reference_id
            );
        ELSIF v_has_metadata THEN
            INSERT INTO public.credit_transactions (
                user_id, type, amount, balance_after, description,
                reference_type, reference_id, metadata
            ) VALUES (
                p_user_id, 'refunded', p_amount, v_new_balance, p_description,
                COALESCE(p_reference_type, 'refund'), p_reference_id, p_metadata
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id, type, amount, balance_after, description,
                reference_type, reference_id
            ) VALUES (
                p_user_id, 'refunded', p_amount, v_new_balance, p_description,
                COALESCE(p_reference_type, 'refund'), p_reference_id
            );
        END IF;
    ELSE
        RETURN json_build_object('success', false, 'reason', 'schema_error', 'message', 'credit_transactions has no supported transaction type column');
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Credits refunded successfully',
        'credits_refunded', p_amount,
        'previous_balance', v_previous_balance,
        'new_balance', v_new_balance
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'database_error',
            'message', 'Error refunding credits: ' || SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_chat_message(
    p_user_id UUID,
    p_source TEXT DEFAULT 'credits',
    p_credits INTEGER DEFAULT 1,
    p_period_end TIMESTAMPTZ DEFAULT NULL,
    p_reason TEXT DEFAULT 'AI chat response failed',
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quota_id UUID;
    v_used_quantity INTEGER;
    v_refund_key TEXT;
BEGIN
    v_refund_key := NULLIF(p_metadata->>'refund_key', '');
    IF v_refund_key IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM public.feature_usage_events
            WHERE user_id = p_user_id
              AND feature_key = 'ai_chat_refund'
              AND metadata->>'refund_key' = v_refund_key
        ) THEN
            RETURN json_build_object('success', true, 'idempotent', true, 'message', 'Chat refund already recorded');
        END IF;
    END IF;

    IF p_source = 'free_quota' THEN
        SELECT id, used_quantity
        INTO v_quota_id, v_used_quantity
        FROM public.user_feature_quotas
        WHERE user_id = p_user_id
          AND feature_key = 'ai_chat'
          AND source = 'subscription'
          AND (p_period_end IS NULL OR period_end = p_period_end)
        ORDER BY period_end DESC
        LIMIT 1
        FOR UPDATE;

        IF v_quota_id IS NULL THEN
            RETURN json_build_object('success', false, 'reason', 'quota_not_found', 'message', 'Could not find chat quota to refund');
        END IF;

        UPDATE public.user_feature_quotas
        SET used_quantity = GREATEST(COALESCE(v_used_quantity, 0) - 1, 0),
            updated_at = NOW()
        WHERE id = v_quota_id;

        INSERT INTO public.feature_usage_events (
            user_id, feature_key, quantity, reference_type, metadata
        ) VALUES (
            p_user_id,
            'ai_chat_refund',
            1,
            'quota_refund',
            jsonb_build_object('source', p_source, 'reason', p_reason) || COALESCE(p_metadata, '{}'::jsonb)
        );

        RETURN json_build_object('success', true, 'source', 'free_quota', 'messages_refunded', 1);
    END IF;

    RETURN public.refund_credits(
        p_user_id,
        GREATEST(COALESCE(p_credits, 1), 1),
        'Refund: ' || COALESCE(p_reason, 'AI chat response failed'),
        'refund',
        NULL,
        jsonb_build_object('source', 'ai_chat', 'original_source', p_source, 'reason', p_reason) || COALESCE(p_metadata, '{}'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INTEGER, TEXT, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_chat_message(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT, JSONB) TO service_role;
