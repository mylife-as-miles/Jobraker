-- ==========================================================================
-- FIX: Referral credit attribution
-- ==========================================================================
-- Problem: The original claim_referral_attribution (migration 20260419180000)
-- did NOT include credit rewards. The updated version (20260524120000) added
-- credits but may not have been deployed, or the old version was re-applied
-- after it. This migration is the single source of truth and guarantees the
-- credit-awarding version is live.
-- ==========================================================================

-- 1. Replace claim_referral_attribution with the credit-awarding version
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
  -- ── Guard clauses ──────────────────────────────────────────────────────
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

  -- ── Daily cap ──────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO today_cnt
  FROM public.referrals r
  WHERE r.referrer_user_id = ref_profile.id
    AND r.signed_up_at::date = (now() AT TIME ZONE 'utc')::date;

  IF today_cnt >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referrer_daily_cap');
  END IF;

  -- ── Attribution ────────────────────────────────────────────────────────
  UPDATE public.profiles
  SET referred_by_user_id = ref_profile.id
  WHERE id = uid
    AND referred_by_user_id IS NULL;

  SELECT email INTO ref_email FROM auth.users WHERE id = uid LIMIT 1;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referred_email, funnel_stage)
  VALUES (ref_profile.id, uid, ref_email, 'signed_up')
  ON CONFLICT (referred_user_id) DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════
  -- REWARD: 50 credits to REFERRER
  -- ══════════════════════════════════════════════════════════════════════
  INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
  VALUES (ref_profile.id, 50, 50, 0, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_credits.balance + 50,
      lifetime_earned = public.user_credits.lifetime_earned + 50,
      updated_at = now();

  SELECT balance INTO v_ref_credits_bal FROM public.user_credits WHERE user_id = ref_profile.id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
  VALUES (ref_profile.id, 50, 'earn', 'Referral reward: friend signed up', v_ref_credits_bal, 'referral', uid);

  -- ══════════════════════════════════════════════════════════════════════
  -- REWARD: 50 credits to REFEREE (new user)
  -- ══════════════════════════════════════════════════════════════════════
  INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
  VALUES (uid, 50, 50, 0, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_credits.balance + 50,
      lifetime_earned = public.user_credits.lifetime_earned + 50,
      updated_at = now();

  SELECT balance INTO v_referred_credits_bal FROM public.user_credits WHERE user_id = uid;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
  VALUES (uid, 50, 'earn', 'Referral signup bonus: joined via referral link', v_referred_credits_bal, 'referral', ref_profile.id);

  -- ── Funnel sync ────────────────────────────────────────────────────────
  PERFORM public.sync_referral_funnel_for_user(uid);

  RETURN jsonb_build_object('ok', true, 'referrer_id', ref_profile.id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_attribution(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_attribution(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_attribution(text) TO service_role;


-- ==========================================================================
-- 2. RETROACTIVE REPAIR: Credit referrers who were missed
-- ==========================================================================
-- Find all referral rows where the referrer never received a credit_transaction
-- for that specific referral, and award the 50 credits now.
-- ==========================================================================
DO $$
DECLARE
  r RECORD;
  v_bal int;
BEGIN
  FOR r IN
    SELECT ref.referrer_user_id, ref.referred_user_id
    FROM public.referrals ref
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.credit_transactions ct
      WHERE ct.user_id = ref.referrer_user_id
        AND ct.reference_type = 'referral'
        AND ct.reference_id = ref.referred_user_id
        AND ct.transaction_type = 'earn'
        AND ct.amount = 50
    )
  LOOP
    -- Credit the referrer
    INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
    VALUES (r.referrer_user_id, 50, 50, 0, now())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + 50,
        lifetime_earned = public.user_credits.lifetime_earned + 50,
        updated_at = now();

    SELECT balance INTO v_bal FROM public.user_credits WHERE user_id = r.referrer_user_id;

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
    VALUES (
      r.referrer_user_id,
      50,
      'earn',
      'Referral reward (retroactive fix): friend signed up',
      v_bal,
      'referral',
      r.referred_user_id
    );

    RAISE NOTICE 'Retroactively credited referrer % for referred user %', r.referrer_user_id, r.referred_user_id;
  END LOOP;

  -- Also check if any referred users missed their 50 credits
  FOR r IN
    SELECT ref.referrer_user_id, ref.referred_user_id
    FROM public.referrals ref
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.credit_transactions ct
      WHERE ct.user_id = ref.referred_user_id
        AND ct.reference_type = 'referral'
        AND ct.reference_id = ref.referrer_user_id
        AND ct.transaction_type = 'earn'
        AND ct.amount = 50
    )
  LOOP
    INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent, last_refill)
    VALUES (r.referred_user_id, 50, 50, 0, now())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + 50,
        lifetime_earned = public.user_credits.lifetime_earned + 50,
        updated_at = now();

    SELECT balance INTO v_bal FROM public.user_credits WHERE user_id = r.referred_user_id;

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, reference_type, reference_id)
    VALUES (
      r.referred_user_id,
      50,
      'earn',
      'Referral signup bonus (retroactive fix): joined via referral link',
      v_bal,
      'referral',
      r.referrer_user_id
    );

    RAISE NOTICE 'Retroactively credited referee % for referrer %', r.referred_user_id, r.referrer_user_id;
  END LOOP;
END $$;
