-- Update credit initialization for new users
-- New users get 50 credits (signup bonus only)
-- Monthly 10 credits are allocated 1 month after registration

-- Function to initialize credits for new users (signup bonus only - 50 credits)
CREATE OR REPLACE FUNCTION "public"."initialize_user_credits"()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user credits record with 50 credits (signup bonus only)
    INSERT INTO "public"."user_credits" (
        "user_id",
        "balance", 
        "lifetime_earned",
        "lifetime_spent",
        "last_refill"
    ) VALUES (
        NEW.id,
        50, -- Signup bonus only
        50,
        0,
        NOW() -- Track when they signed up for monthly refill calculation
    );
    
    -- Record the signup bonus transaction
    INSERT INTO "public"."credit_transactions" (
        "user_id",
        "transaction_type",
        "amount",
        "balance_after",
        "description",
        "reference_type"
    ) VALUES (
        NEW.id,
        'bonus',
        50,
        50,
        'New user signup bonus - 50 credits',
        'signup'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically initialize credits for new users
DROP TRIGGER IF EXISTS "initialize_user_credits_trigger" ON "auth"."users";
CREATE TRIGGER "initialize_user_credits_trigger"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."initialize_user_credits"();

-- Function to handle monthly credit refills (runs via cron job or manual execution)
CREATE OR REPLACE FUNCTION "public"."refill_monthly_credits"()
RETURNS TABLE(user_id uuid, credits_added integer, new_balance integer) AS $$
BEGIN
    RETURN QUERY
    WITH refill_users AS (
        SELECT 
            uc.user_id,
            sp.credits_per_month,
            uc.balance,
            uc.last_refill
        FROM user_credits uc
        JOIN user_subscriptions us ON us.user_id = uc.user_id AND us.status = 'active'
        JOIN subscription_plans sp ON sp.id = us.subscription_plan_id
        WHERE 
            -- Only refill if it's been at least 1 month since last refill or signup
            uc.last_refill < NOW() - INTERVAL '1 month'
            AND sp.credits_per_month > 0
    )
    UPDATE user_credits uc
    SET 
        balance = uc.balance + ru.credits_per_month,
        lifetime_earned = uc.lifetime_earned + ru.credits_per_month,
        last_refill = NOW(),
        updated_at = NOW()
    FROM refill_users ru
    WHERE uc.user_id = ru.user_id
    RETURNING uc.user_id, ru.credits_per_month::integer, uc.balance;
END;
$$ LANGUAGE plpgsql;

-- Function to record monthly refill transactions
CREATE OR REPLACE FUNCTION "public"."record_monthly_refill_transactions"()
RETURNS void AS $$
BEGIN
    -- Record transactions for users who just got refilled
    INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, description)
    SELECT 
        uc.user_id,
        'refill',
        sp.credits_per_month,
        uc.balance,
        CASE sp.name
            WHEN 'Free' THEN 'Free tier monthly credit allocation - 10 credits'
            WHEN 'Pro' THEN 'Pro tier monthly credit allocation - 1000 credits'
            WHEN 'Ultimate' THEN 'Ultimate tier monthly credit allocation - 5000 credits'
            ELSE 'Monthly credit allocation - ' || sp.credits_per_month || ' credits'
        END
    FROM user_credits uc
    JOIN user_subscriptions us ON us.user_id = uc.user_id AND us.status = 'active'
    JOIN subscription_plans sp ON sp.id = us.subscription_plan_id
    WHERE 
        uc.updated_at > NOW() - INTERVAL '5 minutes' -- Only record recent refills
        AND NOT EXISTS (
            SELECT 1 FROM credit_transactions ct
            WHERE ct.user_id = uc.user_id 
            AND ct.transaction_type = 'refill'
            AND ct.created_at > NOW() - INTERVAL '5 minutes'
        );
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the credit system
COMMENT ON FUNCTION "public"."initialize_user_credits"() IS 
'Initializes new users with 50 credits (signup bonus only). Monthly credits are allocated after 1 month via refill_monthly_credits function.';

COMMENT ON FUNCTION "public"."refill_monthly_credits"() IS 
'Allocates monthly credits to users who have been registered for at least 1 month. Should be run via a scheduled job (cron/pg_cron).';
