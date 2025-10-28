-- Give credits to buzztuneinfo@gmail.com for testing

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user ID for buzztuneinfo@gmail.com
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'buzztuneinfo@gmail.com';

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User buzztuneinfo@gmail.com not found';
        RETURN;
    END IF;

    -- Check if user has a credits record
    IF NOT EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = target_user_id) THEN
        -- Create credits record with 100 credits
        INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
        VALUES (target_user_id, 100, 100, 0);
        
        RAISE NOTICE 'Created credits record with 100 credits for user: %', target_user_id;
    ELSE
        -- Add 100 credits to existing balance
        UPDATE public.user_credits
        SET 
            balance = balance + 100,
            lifetime_earned = lifetime_earned + 100,
            updated_at = NOW()
        WHERE user_id = target_user_id;
        
        RAISE NOTICE 'Added 100 credits to existing balance for user: %', target_user_id;
    END IF;

    -- Record the transaction
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
        100,
        uc.balance - 100,
        uc.balance,
        'Manual credit refill for testing'
    FROM public.user_credits uc
    WHERE uc.user_id = target_user_id;

    RAISE NOTICE 'Credits added successfully for buzztuneinfo@gmail.com';
END $$;
