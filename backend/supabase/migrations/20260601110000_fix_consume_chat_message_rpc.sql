-- Fix consume_chat_message RPC to dynamically check for columns on credit_transactions (type vs transaction_type, balance_before) and use 'deduction' to satisfy check constraints
CREATE OR REPLACE FUNCTION public.consume_chat_message(
    p_user_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_quota RECORD;
    v_remaining_free INT := 0;          
    v_credit_balance INT := 0;
    v_new_balance INT;
    v_has_type_col BOOLEAN;
    v_has_balance_before BOOLEAN;
BEGIN
    -- Check credit_transactions schema structure dynamically
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'type'
    ) INTO v_has_type_col;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'balance_before'
    ) INTO v_has_balance_before;

    SELECT
        us.current_period_start,
        us.current_period_end,
        us.created_at,
        sp.name AS plan_name,
        COALESCE(sp.chat_monthly_limit, 0) AS chat_limit
    INTO v_subscription
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.subscription_plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF NOT FOUND OR COALESCE(v_subscription.chat_limit, 0) <= 0 THEN
        SELECT balance INTO v_credit_balance
        FROM public.user_credits
        WHERE user_id = p_user_id;

        IF v_credit_balance IS NULL OR v_credit_balance < 1 THEN
            RETURN json_build_object(
                'success', false,
                'reason', 'insufficient_credits',
                'message', 'You don''t have enough credits. Purchase more credits to continue chatting.',
                'balance', COALESCE(v_credit_balance, 0),
                'free_remaining', 0
            );
        END IF;

        UPDATE public.user_credits
        SET balance = balance - 1,
            total_consumed = COALESCE(total_consumed, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;

        IF v_has_type_col THEN
            IF v_has_balance_before THEN
                INSERT INTO public.credit_transactions (
                    user_id, type, amount, balance_before, balance_after,
                    description, reference_type
                ) VALUES (
                    p_user_id, 'deduction', 1, v_new_balance + 1, v_new_balance,
                    'AI chat message', 'ai_chat'
                );
            ELSE
                INSERT INTO public.credit_transactions (
                    user_id, type, amount, balance_after,
                    description, reference_type
                ) VALUES (
                    p_user_id, 'deduction', 1, v_new_balance,
                    'AI chat message', 'ai_chat'
                );
            END IF;
        ELSE
            IF v_has_balance_before THEN
                INSERT INTO public.credit_transactions (
                    user_id, transaction_type, amount, balance_before, balance_after,
                    description, reference_type
                ) VALUES (
                    p_user_id, 'deduction', 1, v_new_balance + 1, v_new_balance,
                    'AI chat message', 'ai_chat'
                );
            ELSE
                INSERT INTO public.credit_transactions (
                    user_id, transaction_type, amount, balance_after,
                    description, reference_type
                ) VALUES (
                    p_user_id, 'deduction', 1, v_new_balance,
                    'AI chat message', 'ai_chat'
                );
            END IF;
        END IF;

        INSERT INTO public.feature_usage_events (
            user_id, feature_key, quantity, reference_type, metadata
        ) VALUES (
            p_user_id, 'ai_chat', 1, 'credit',
            jsonb_build_object('source', 'credits')
        );

        RETURN json_build_object(
            'success', true,
            'source', 'credits',
            'credits_used', 1,
            'balance', v_new_balance,
            'free_remaining', 0
        );
    END IF;

    v_period_start := COALESCE(v_subscription.current_period_start, date_trunc('month', NOW()));
    v_period_end := COALESCE(v_subscription.current_period_end, v_period_start + INTERVAL '1 month');

    INSERT INTO public.user_feature_quotas (
        user_id, feature_key, source, period_start, period_end,
        included_quantity, metadata
    ) VALUES (
        p_user_id, 'ai_chat', 'subscription', v_period_start, v_period_end,
        v_subscription.chat_limit,
        jsonb_build_object('plan_name', v_subscription.plan_name)
    )
    ON CONFLICT (user_id, feature_key, source, period_start, period_end)
    DO UPDATE SET
        included_quantity = EXCLUDED.included_quantity,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();

    SELECT *
    INTO v_quota
    FROM public.user_feature_quotas
    WHERE user_id = p_user_id
      AND feature_key = 'ai_chat'
      AND source = 'subscription'
      AND period_start = v_period_start
      AND period_end = v_period_end
    FOR UPDATE;

    v_remaining_free := GREATEST(v_quota.included_quantity - v_quota.used_quantity, 0);

    IF v_remaining_free > 0 THEN
        UPDATE public.user_feature_quotas
        SET used_quantity = used_quantity + 1,
            updated_at = NOW()
        WHERE id = v_quota.id;

        INSERT INTO public.feature_usage_events (
            user_id, feature_key, quantity, reference_type, metadata
        ) VALUES (
            p_user_id, 'ai_chat', 1, 'quota',
            jsonb_build_object('source', 'free_quota', 'plan_name', v_subscription.plan_name)
        );

        RETURN json_build_object(
            'success', true,
            'source', 'free_quota',
            'credits_used', 0,
            'free_remaining', v_remaining_free - 1,
            'free_total', v_quota.included_quantity,
            'period_end', v_quota.period_end
        );
    END IF;

    SELECT balance INTO v_credit_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    IF v_credit_balance IS NULL OR v_credit_balance < 1 THEN
        RETURN json_build_object(
            'success', false,
            'reason', 'insufficient_credits',
            'message', 'Your free messages are used up and you don''t have enough credits. Purchase more to continue.',
            'balance', COALESCE(v_credit_balance, 0),
            'free_remaining', 0,
            'free_total', v_quota.included_quantity
        );
    END IF;

    UPDATE public.user_credits
    SET balance = balance - 1,
        total_consumed = COALESCE(total_consumed, 0) + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    IF v_has_type_col THEN
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id, type, amount, balance_before, balance_after,
                description, reference_type
            ) VALUES (
                p_user_id, 'deduction', 1, v_new_balance + 1, v_new_balance,
                'AI chat message (free quota exhausted)', 'ai_chat'
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id, type, amount, balance_after,
                description, reference_type
            ) VALUES (
                p_user_id, 'deduction', 1, v_new_balance,
                'AI chat message (free quota exhausted)', 'ai_chat'
            );
        END IF;
    ELSE
        IF v_has_balance_before THEN
            INSERT INTO public.credit_transactions (
                user_id, transaction_type, amount, balance_before, balance_after,
                description, reference_type
            ) VALUES (
                p_user_id, 'deduction', 1, v_new_balance + 1, v_new_balance,
                'AI chat message (free quota exhausted)', 'ai_chat'
            );
        ELSE
            INSERT INTO public.credit_transactions (
                user_id, transaction_type, amount, balance_after,
                description, reference_type
            ) VALUES (
                p_user_id, 'deduction', 1, v_new_balance,
                'AI chat message (free quota exhausted)', 'ai_chat'
            );
        END IF;
    END IF;

    INSERT INTO public.feature_usage_events (
        user_id, feature_key, quantity, reference_type, metadata
    ) VALUES (
        p_user_id, 'ai_chat', 1, 'credit',
        jsonb_build_object('source', 'credits', 'plan_name', v_subscription.plan_name)
    );

    RETURN json_build_object(
        'success', true,
        'source', 'credits',
        'credits_used', 1,
        'balance', v_new_balance,
        'free_remaining', 0,
        'free_total', v_quota.included_quantity,
        'period_end', v_quota.period_end
    );
END;
$$;
