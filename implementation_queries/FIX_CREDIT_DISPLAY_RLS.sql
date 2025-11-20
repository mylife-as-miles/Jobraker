-- Fix RLS policies for credit system tables
-- This ensures users can read their own credit data

-- Enable RLS on user_credits table
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Everyone can view subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Everyone can view credit costs" ON credit_costs;

-- Create policy for user_credits (users can view their own credits)
CREATE POLICY "Users can view their own credits"
ON user_credits
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for user_subscriptions (users can view their own subscriptions)
CREATE POLICY "Users can view their own subscriptions"
ON user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for credit_transactions (users can view their own transactions)
CREATE POLICY "Users can view their own transactions"
ON credit_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for subscription_plans (everyone can view plans)
CREATE POLICY "Everyone can view subscription plans"
ON subscription_plans
FOR SELECT
USING (true);

-- Create policy for credit_costs (everyone can view costs)
CREATE POLICY "Everyone can view credit costs"
ON credit_costs
FOR SELECT
USING (true);

-- Verify policies are created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('user_credits', 'user_subscriptions', 'credit_transactions', 'subscription_plans', 'credit_costs')
ORDER BY tablename, policyname;
