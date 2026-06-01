-- Add missing columns to user_credits to prevent RPC errors in consume_chat_message
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS total_consumed INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS lifetime_spent INTEGER DEFAULT 0 NOT NULL;
