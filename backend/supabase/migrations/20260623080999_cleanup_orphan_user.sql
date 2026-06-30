-- Delete orphan user_credits records that don't exist in auth.users
DELETE FROM public.user_credits
WHERE user_id NOT IN (SELECT id FROM auth.users);
