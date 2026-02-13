-- Migration to give 1000 credits to ezeagwujohnpaul@gmail.com
-- Revised: Tracking minimal transaction data to avoid missing column errors
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'ezeagwujohnpaul@gmail.com';

  IF target_user_id IS NOT NULL THEN
    -- Insert or Update user_credits (only balance and updated_at)
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (target_user_id, 1000)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance = user_credits.balance + 1000,
        updated_at = now();

    -- Record the transaction (Minimal columns)
    -- We removed balance_before/after as they don't exist in your schema
    INSERT INTO public.credit_transactions (
        user_id,
        transaction_type,
        amount,
        description
    ) VALUES (
        target_user_id,
        'earned',
        1000,
        'Manual grant: 1000 credits'
    );

    RAISE NOTICE 'Granted 1000 credits to %', target_user_id;
  ELSE
    RAISE WARNING 'User with email ezeagwujohnpaul@gmail.com not found';
  END IF;
END $$;
