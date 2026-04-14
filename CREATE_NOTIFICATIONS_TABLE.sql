-- Run this entire script in the Supabase Dashboard SQL Editor

-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL, -- e.g., 'application_update', 'system', 'payment'
    read_status boolean DEFAULT false NOT NULL,
    link text, -- optional URL to click through
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Add an index for fetching users' notifications quickly
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for the user
-- Users can read their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (e.g. mark as read)
CREATE POLICY "Users can update their own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications (optional, but good for cleanup)
CREATE POLICY "Users can delete their own notifications"
    ON public.notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Add notifications to the realtime publication
-- This allows the frontend to listen for new inserts instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
