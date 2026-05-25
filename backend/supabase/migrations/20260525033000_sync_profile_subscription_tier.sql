-- Migration: Sync Profiles Subscription Tier from User Subscriptions
-- Created: 2026-05-25

-- 1. Sync all existing profiles' subscription tiers
UPDATE public.profiles p
SET subscription_tier = public.normalize_tier(public.get_user_tier(p.id));

-- 2. Define trigger function to automatically update profiles.subscription_tier
CREATE OR REPLACE FUNCTION public.sync_profile_subscription_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_tier text;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_tier := public.get_user_tier(v_user_id);
  
  UPDATE public.profiles
  SET 
    subscription_tier = public.normalize_tier(v_tier),
    updated_at = NOW()
  WHERE id = v_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind the trigger to public.user_subscriptions
DROP TRIGGER IF EXISTS sync_profile_subscription_tier_trigger ON public.user_subscriptions;
CREATE TRIGGER sync_profile_subscription_tier_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_subscription_tier();
