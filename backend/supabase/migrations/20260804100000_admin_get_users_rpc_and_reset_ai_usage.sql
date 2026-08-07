-- Migration: 20260804100000_admin_get_users_rpc_and_reset_ai_usage.sql
-- 1. Ensure profiles table has email column & trigger sync
-- 2. Provide RPC get_all_users_for_admin to return real emails to Admin portal
-- 3. Provide RPC admin_reset_user_ai_usage to reset daily, weekly, monthly or all AI usage

-- 1. Add email column to public.profiles if not present and sync existing emails
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND (p.email IS NULL OR p.email <> au.email);

-- Trigger function to auto-sync email to public.profiles on insert/update of auth.users
CREATE OR REPLACE FUNCTION public.handle_sync_user_email_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_email_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_sync_user_email_to_profile();

-- 2. RPC to safely fetch all registered users for Admin Portal with real emails
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  roles JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    COALESCE((auth.jwt()->'app_metadata'->>'claims_admin')::boolean, false) = true
    OR
    COALESCE((auth.jwt()->'user_metadata'->>'is_admin')::boolean, false) = true
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    COALESCE(au.email, p.email, 'unknown@jobraker.com')::text AS email,
    au.created_at,
    au.last_sign_in_at,
    COALESCE(
      NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
      (au.raw_user_meta_data->>'full_name'),
      (au.raw_user_meta_data->>'name'),
      'No Name'
    )::text AS full_name,
    p.first_name::text,
    p.last_name::text,
    p.avatar_url::text,
    COALESCE(
      (
        SELECT jsonb_agg(ur.role)
        FROM public.user_roles ur
        WHERE ur.user_id = au.id
      ),
      '[]'::jsonb
    ) AS roles
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO service_role;

-- 3. RPC to reset daily, weekly, monthly, or all AI usage for a given user
CREATE OR REPLACE FUNCTION public.admin_reset_user_ai_usage(
  p_user_id UUID,
  p_window TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_period RECORD;
  v_cutoff TIMESTAMPTZ;
  v_ai_count INT := 0;
  v_comp_count INT := 0;
BEGIN
  -- Verify caller is admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    COALESCE((auth.jwt()->'app_metadata'->>'claims_admin')::boolean, false) = true
    OR
    COALESCE((auth.jwt()->'user_metadata'->>'is_admin')::boolean, false) = true
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);

  IF p_window = 'daily' THEN
    v_cutoff := v_now - INTERVAL '24 hours';
  ELSIF p_window = 'weekly' THEN
    v_cutoff := v_period.weekly_window_start;
  ELSIF p_window = 'monthly' THEN
    v_cutoff := v_period.current_period_start;
  ELSE
    v_cutoff := '1970-01-01 00:00:00+00'::TIMESTAMPTZ;
  END IF;

  -- Release/zero out billable ai_usage_events
  UPDATE public.ai_usage_events
  SET billable = false,
      reserved_cost_nanos = 0,
      metadata = metadata || jsonb_build_object('reset_by_admin', auth.uid(), 'reset_window', p_window, 'reset_at', v_now)
  WHERE user_id = p_user_id
    AND created_at >= v_cutoff
    AND billable = true;

  GET DIAGNOSTICS v_ai_count = ROW_COUNT;

  -- Release/zero out billable composio_usage_events
  UPDATE public.composio_usage_events
  SET billable = false,
      reserved_cost_nanos = 0,
      metadata = metadata || jsonb_build_object('reset_by_admin', auth.uid(), 'reset_window', p_window, 'reset_at', v_now)
  WHERE user_id = p_user_id
    AND created_at >= v_cutoff
    AND billable = true;

  GET DIAGNOSTICS v_comp_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'window', p_window,
    'ai_events_reset', v_ai_count,
    'composio_events_reset', v_comp_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_ai_usage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_ai_usage(uuid, text) TO service_role;
