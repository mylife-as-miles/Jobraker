-- RPC for atomic credit additions to avoid race conditions via webhook

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
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_current_earned INTEGER;
    v_result JSON;
    v_has_type_column BOOLEAN;
BEGIN
    -- Only allow positive amounts
    IF p_amount <= 0 THEN
        v_result := json_build_object(
            'success', false,
            'message', 'Amount must be greater than 0'
        );
        RETURN v_result;
    END IF;

    -- Upsert credits atomically
    INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
    VALUES (p_user_id, p_amount, p_amount, 0)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        balance = user_credits.balance + EXCLUDED.balance,
        lifetime_earned = user_credits.lifetime_earned + EXCLUDED.lifetime_earned,
        updated_at = NOW()
    RETURNING balance, balance - EXCLUDED.balance INTO v_new_balance, v_current_balance;

    -- Record transaction safely
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'type'
    ) INTO v_has_type_column;
    
    IF v_has_type_column THEN
        INSERT INTO public.credit_transactions (
            user_id, type, amount, balance_after, description, reference_type, reference_id, metadata
        ) VALUES (
            p_user_id, 'earned', p_amount, v_new_balance, p_description, p_reference_type, p_reference_id, p_metadata
        );
    ELSE
        INSERT INTO public.credit_transactions (
            user_id, transaction_type, amount, balance_after, description, reference_type, reference_id, metadata
        ) VALUES (
            p_user_id, 'earned', p_amount, v_new_balance, p_description, p_reference_type, p_reference_id, p_metadata
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Credits added successfully',
        'previous_balance', v_current_balance,
        'new_balance', v_new_balance
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT, UUID, JSONB) TO service_role;
