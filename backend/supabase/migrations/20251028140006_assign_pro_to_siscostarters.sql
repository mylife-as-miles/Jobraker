-- Assign Pro subscription plan to siscostarters@gmail.com
-- This gives them the Pro tier with 1000 credits per month

DO $$
DECLARE
    target_user_id UUID;
    pro_plan_id UUID;
    subscription_exists BOOLEAN;
    current_balance INTEGER;
BEGIN
    -- Get the user ID for the email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'siscostarters@gmail.com';

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User with email siscostarters@gmail.com not found';
        RETURN;
    END IF;

    -- Get the Pro plan ID
    SELECT id INTO pro_plan_id
    FROM public.subscription_plans
    WHERE name = 'Pro';

    IF pro_plan_id IS NULL THEN
        RAISE NOTICE 'Pro subscription plan not found';
        RETURN;
    END IF;

    -- Get current credit balance
    SELECT balance INTO current_balance
    FROM public.user_credits
    WHERE user_id = target_user_id;

    IF current_balance IS NULL THEN
        current_balance := 0;
    END IF;

    -- Check if user already has an active subscription
    SELECT EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE user_id = target_user_id AND status = 'active'
    ) INTO subscription_exists;

    IF subscription_exists THEN
        -- Update existing subscription to Pro
        UPDATE public.user_subscriptions
        SET
            subscription_plan_id = pro_plan_id,
            current_period_start = NOW(),
            current_period_end = NOW() + INTERVAL '1 month',
            updated_at = NOW()
        WHERE user_id = target_user_id AND status = 'active';

        RAISE NOTICE 'Updated existing subscription to Pro plan for user: %', target_user_id;
    ELSE
        -- Create new subscription
        INSERT INTO public.user_subscriptions (
            user_id,
            subscription_plan_id,
            status,
            current_period_start,
            current_period_end
        ) VALUES (
            target_user_id,
            pro_plan_id,
            'active',
            NOW(),
            NOW() + INTERVAL '1 month'
        );

        RAISE NOTICE 'Created new Pro subscription for user: %', target_user_id;
    END IF;

    -- Update profile subscription_tier
    UPDATE public.profiles
    SET subscription_tier = 'Pro', updated_at = NOW()
    WHERE id = target_user_id;

    -- Ensure user has credits record
    IF NOT EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = target_user_id) THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (target_user_id, 1000, 1000, 0);

        RAISE NOTICE 'Created credits record with 1000 credits for user: %', target_user_id;
    ELSE
        -- Add 1000 credits for the Pro plan
        UPDATE public.user_credits
        SET
            balance = balance + 1000,
            lifetime_earned = lifetime_earned + 1000,
            updated_at = NOW()
        WHERE user_id = target_user_id;

        RAISE NOTICE 'Added 1000 credits to existing balance for user: %', target_user_id;
    END IF;

    -- Record the credit transaction
    INSERT INTO public.credit_transactions (
        user_id,
        transaction_type,
        amount,
        balance_after,
        description
    )
    SELECT
        target_user_id,
        'bonus',
        1000,
        uc.balance,
        'Pro plan subscription - 1000 monthly credits'
    FROM public.user_credits uc
    WHERE uc.user_id = target_user_id;

    RAISE NOTICE '=== Pro Plan Assigned ===';
    RAISE NOTICE 'User: siscostarters@gmail.com';
    RAISE NOTICE 'User ID: %', target_user_id;
    RAISE NOTICE 'Plan: Pro ($49/month)';
    RAISE NOTICE 'Credits: 1000 per month';
    RAISE NOTICE '===========================';
END $$;
