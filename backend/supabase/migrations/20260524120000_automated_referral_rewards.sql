-- Automated referral rewards: credit bonuses on signup and milestones

-- 1. Create a trigger function to handle milestone rewards automatically on funnel stage updates
CREATE OR REPLACE FUNCTION public.process_referral_milestone_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_credits_bal int;
  v_rewarded_stages jsonb;
  v_metadata jsonb;
BEGIN
  IF NEW.funnel_stage = OLD.funnel_stage THEN
    RETURN NEW;
  END IF;

  v_metadata := NEW.metadata;
  IF v_metadata IS NULL THEN
    v_metadata := '{}'::jsonb;
  END IF;
  
  v_rewarded_stages := COALESCE(v_metadata->'rewarded_stages', '[]'::jsonb);

  -- Reward for application_completed (+100 credits to referrer)
  IF NEW.funnel_stage = 'application_completed' AND NOT (v_rewarded_stages ? 'application_completed') THEN
    -- Ensure referrer's user_credits record exists
    INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
    VALUES (NEW.referrer_user_id, 100, 100, 0, now())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + 100,
        lifetime_earned = public.user_credits.lifetime_earned + 100,
        updated_at = now();

    SELECT balance INTO v_ref_credits_bal FROM public.user_credits WHERE user_id = NEW.referrer_user_id;

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
    VALUES (NEW.referrer_user_id, 100, 'earn', 'Referral milestone: friend submitted first application', v_ref_credits_bal, 'referral', NEW.referred_user_id);

    v_rewarded_stages := jsonb_insert(v_rewarded_stages, '{0}', '"application_completed"'::jsonb);
    v_metadata := jsonb_set(v_metadata, '{rewarded_stages}', v_rewarded_stages);
  END IF;

  -- Reward for hired (+250 credits to referrer)
  IF NEW.funnel_stage = 'hired' AND NOT (v_rewarded_stages ? 'hired') THEN
    -- Ensure referrer's user_credits record exists
    INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
    VALUES (NEW.referrer_user_id, 250, 250, 0, now())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + 250,
        lifetime_earned = public.user_credits.lifetime_earned + 250,
        updated_at = now();

    SELECT balance INTO v_ref_credits_bal FROM public.user_credits WHERE user_id = NEW.referrer_user_id;

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
    VALUES (NEW.referrer_user_id, 250, 'earn', 'Referral milestone: friend marked hired', v_ref_credits_bal, 'referral', NEW.referred_user_id);

    v_rewarded_stages := jsonb_insert(v_rewarded_stages, '{0}', '"hired"'::jsonb);
    v_metadata := jsonb_set(v_metadata, '{rewarded_stages}', v_rewarded_stages);
  END IF;

  NEW.metadata := v_metadata;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_milestone_rewards ON public.referrals;
CREATE TRIGGER trg_referral_milestone_rewards
  BEFORE UPDATE OF funnel_stage ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_milestone_rewards();


-- 2. Modify claim_referral_attribution function to award signup credits to both referrer and referee
CREATE OR REPLACE FUNCTION public.claim_referral_attribution(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  ref_profile public.profiles%ROWTYPE;
  ref_email text;
  today_cnt int;
  v_ref_credits_bal int;
  v_referred_credits_bal int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_code');
  END IF;

  SELECT * INTO ref_profile
  FROM public.profiles
  WHERE lower(trim(referral_code)) = lower(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF ref_profile.id = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND referred_by_user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_attributed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = uid) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'referral_row_exists');
  END IF;

  SELECT COUNT(*) INTO today_cnt
  FROM public.referrals r
  WHERE r.referrer_user_id = ref_profile.id
    AND r.signed_up_at::date = (now() AT TIME ZONE 'utc')::date;

  IF today_cnt >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referrer_daily_cap');
  END IF;

  UPDATE public.profiles
  SET referred_by_user_id = ref_profile.id
  WHERE id = uid
    AND referred_by_user_id IS NULL;

  SELECT email INTO ref_email FROM auth.users WHERE id = uid LIMIT 1;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referred_email, funnel_stage)
  VALUES (ref_profile.id, uid, ref_email, 'signed_up')
  ON CONFLICT (referred_user_id) DO NOTHING;

  -- ==========================================
  -- REWARD: Add 50 credits to referrer
  -- ==========================================
  INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
  VALUES (ref_profile.id, 50, 50, 0, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_credits.balance + 50,
      lifetime_earned = public.user_credits.lifetime_earned + 50,
      updated_at = now();

  SELECT balance INTO v_ref_credits_bal FROM public.user_credits WHERE user_id = ref_profile.id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
  VALUES (ref_profile.id, 50, 'earn', 'Referral reward: friend signed up', v_ref_credits_bal, 'referral', uid);

  -- ==========================================
  -- REWARD: Add 50 credits to referee (new user)
  -- ==========================================
  INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
  VALUES (uid, 50, 50, 0, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_credits.balance + 50,
      lifetime_earned = public.user_credits.lifetime_earned + 50,
      updated_at = now();

  SELECT balance INTO v_referred_credits_bal FROM public.user_credits WHERE user_id = uid;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
  VALUES (uid, 50, 'earn', 'Referral signup bonus: joined via referral link', v_referred_credits_bal, 'referral', ref_profile.id);

  PERFORM public.sync_referral_funnel_for_user(uid);

  RETURN jsonb_build_object('ok', true, 'referrer_id', ref_profile.id);
END;
$$;
