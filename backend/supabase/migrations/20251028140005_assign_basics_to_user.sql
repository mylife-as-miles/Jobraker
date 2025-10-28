-- Assign Basics subscription plan to ezeagwujohnpaul@gmail.com
-- This gives them the Basics tier with 200 credits per month

DO $$
DECLARE
    target_user_id UUID;
    basics_plan_id UUID;
    subscription_exists BOOLEAN;
BEGIN
    -- Get the user ID for the email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'ezeagwujohnpaul@gmail.com';

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User with email ezeagwujohnpaul@gmail.com not found';
        RETURN;
    END IF;

    -- Get the Basics plan ID
    SELECT id INTO basics_plan_id
    FROM public.subscription_plans
    WHERE name = 'Basics';

    IF basics_plan_id IS NULL THEN
        RAISE NOTICE 'Basics subscription plan not found';
        RETURN;
    END IF;

    -- Check if user already has an active subscription
    SELECT EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE user_id = target_user_id AND status = 'active'
    ) INTO subscription_exists;

    IF subscription_exists THEN
        -- Update existing subscription to Basics
        UPDATE public.user_subscriptions
        SET 
            subscription_plan_id = basics_plan_id,
            current_period_start = NOW(),
            current_period_end = NOW() + INTERVAL '1 month',
            updated_at = NOW()
        WHERE user_id = target_user_id AND status = 'active';
        
        RAISE NOTICE 'Updated existing subscription to Basics plan for user: %', target_user_id;
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
            basics_plan_id,
            'active',
            NOW(),
            NOW() + INTERVAL '1 month'
        );
        
        RAISE NOTICE 'Created new Basics subscription for user: %', target_user_id;
    END IF;

    -- Update profile subscription_tier if it exists
    UPDATE public.profiles
    SET subscription_tier = 'Basics', updated_at = NOW()
    WHERE id = target_user_id;

    -- Ensure user has credits record
    IF NOT EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = target_user_id) THEN
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (target_user_id, 200, 200, 0);
        
        RAISE NOTICE 'Created credits record with 200 credits for user: %', target_user_id;
    ELSE
        -- Add 200 credits for the Basics plan
        UPDATE public.user_credits
        SET 
            balance = balance + 200,
            lifetime_earned = lifetime_earned + 200,
            updated_at = NOW()
        WHERE user_id = target_user_id;
        
        RAISE NOTICE 'Added 200 credits to existing balance for user: %', target_user_id;
    END IF;

    -- Record the credit transaction
    INSERT INTO public.credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        description
    )
    SELECT 
        target_user_id,
        'earned',
        200,
        uc.balance - 200,
        uc.balance,
        'Basics plan subscription - 200 monthly credits'
    FROM public.user_credits uc
    WHERE uc.user_id = target_user_id;

    RAISE NOTICE '=== Basics Plan Assigned ===';
    RAISE NOTICE 'User: ezeagwujohnpaul@gmail.com';
    RAISE NOTICE 'User ID: %', target_user_id;
    RAISE NOTICE 'Plan: Basics ($14/month)';
    RAISE NOTICE 'Credits: 200 per month';
    RAISE NOTICE '===========================';
END $$;
