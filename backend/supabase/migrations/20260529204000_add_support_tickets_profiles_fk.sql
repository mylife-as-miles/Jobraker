-- Migration: Add foreign key constraint from support_tickets to profiles
-- Created at: 2026-05-29

-- Point user_id foreign key constraint directly to public.profiles instead of auth.users
-- This allows PostgREST to automatically resolve joins between support_tickets and profiles
ALTER TABLE public.support_tickets 
DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;

ALTER TABLE public.support_tickets
ADD CONSTRAINT support_tickets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;
