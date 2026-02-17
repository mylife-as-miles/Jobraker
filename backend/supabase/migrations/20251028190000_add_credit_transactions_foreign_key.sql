-- Add foreign key relationship between credit_transactions and profiles
-- This is needed for PostgREST joins like .select('*, profiles(email)')

-- Add foreign key constraint if it doesn't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'credit_transactions_user_id_fkey'
    ) THEN
        ALTER TABLE public.credit_transactions
        ADD CONSTRAINT credit_transactions_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
        
        COMMENT ON CONSTRAINT credit_transactions_user_id_fkey ON public.credit_transactions 
        IS 'Foreign key to auth.users for PostgREST joins';
    END IF;
END $$;

-- Also ensure there's an index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id 
ON public.credit_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference_type 
ON public.credit_transactions(reference_type);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_transaction_type 
ON public.credit_transactions(transaction_type);

-- Add a comment explaining the table relationships
COMMENT ON TABLE public.credit_transactions IS 'Credit transaction history. Foreign key to auth.users allows PostgREST joins with profiles table.';
