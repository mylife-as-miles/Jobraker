-- Migration to give 1000 credits to ezeagwujohnpaul@gmail.com
-- Revised: transaction_type corrected (earned -> bonus)
DO $$
DECLARE
  target_user_id uuid;
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'ezeagwujohnpaul@gmail.com';

  IF target_user_id IS NOT NULL THEN
    -- Get current balance (default to 0)
    SELECT COALESCE(balance, 0) INTO v_current_balance FROM public.user_credits WHERE user_id = target_user_id;
    
    -- Calculate new balance
    v_new_balance := v_current_balance + 1000;

    -- Insert or Update user_credits (only balance, updated_at)
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (target_user_id, 1000)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance = user_credits.balance + 1000,
        updated_at = now();

    -- Record transaction
    -- Allowed types: 'earn', 'spend', 'refund', 'expire', 'bonus', 'refill', 'deduction'
    INSERT INTO public.credit_transactions (
        user_id,
        transaction_type,
        amount,
        balance_after,
        description,
        reference_type
    ) VALUES (
        target_user_id,
        'bonus',  -- CORRECT: 'earned' was invalid
        1000,
        v_new_balance,
        'Manual grant: 1000 credits',
        'admin_grant'
    );

    RAISE NOTICE 'Granted 1000 credits to %. New Balance: %', target_user_id, v_new_balance;
  ELSE
    RAISE WARNING 'User with email ezeagwujohnpaul@gmail.com not found';
  END IF;
END $$;
