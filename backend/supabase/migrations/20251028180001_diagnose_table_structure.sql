-- Diagnostic: Check credit_transactions table structure
DO $$
DECLARE
    v_has_type BOOLEAN;
    v_has_transaction_type BOOLEAN;
    v_columns TEXT;
BEGIN
    -- Check for 'type' column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'type'
    ) INTO v_has_type;
    
    -- Check for 'transaction_type' column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'transaction_type'
    ) INTO v_has_transaction_type;
    
    -- Get all column names
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO v_columns
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_transactions';
    
    RAISE NOTICE '=== CREDIT_TRANSACTIONS TABLE STRUCTURE ===';
    RAISE NOTICE 'Has type column: %', v_has_type;
    RAISE NOTICE 'Has transaction_type column: %', v_has_transaction_type;
    RAISE NOTICE 'All columns: %', v_columns;
    RAISE NOTICE '==========================================';
    
    -- Get CHECK constraint info
    RAISE NOTICE 'CHECK constraints:';
    FOR v_columns IN 
        SELECT conname || ': ' || pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = 'public.credit_transactions'::regclass
        AND contype = 'c'
    LOOP
        RAISE NOTICE '%', v_columns;
    END LOOP;
END $$;
