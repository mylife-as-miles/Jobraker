-- Migration: Allow users and admins to insert AI role messages in support_messages
-- Created at: 2026-05-29

DROP POLICY IF EXISTS "Users and admins can insert support messages" ON public.support_messages;

CREATE POLICY "Users and admins can insert support messages"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND (user_id = auth.uid() OR public.is_admin())
  ) AND (
    (sender_role IN ('user', 'ai') AND NOT public.is_admin()) OR
    (sender_role IN ('admin', 'ai') AND public.is_admin())
  )
);
