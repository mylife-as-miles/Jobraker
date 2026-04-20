-- Add Terminated application status and canonical_stage 'terminated'

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (
    status IN (
      'Draft',
      'Pending',
      'Applied',
      'Failed',
      'Terminated',
      'Interview',
      'Offer',
      'Rejected',
      'Withdrawn'
    )
  );

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_canonical_stage_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_canonical_stage_check
  CHECK (
    canonical_stage IN (
      'draft_ready',
      'queued',
      'submitted',
      'failed',
      'terminated',
      'interview',
      'offer',
      'rejected',
      'withdrawn'
    )
  );

-- Referral funnel: reaching terminated counts as a completed application touchpoint
CREATE OR REPLACE FUNCTION public.sync_referral_funnel_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stage text;
  cur_stage text;
  cur_rank int;
  new_rank int;
BEGIN
  SELECT funnel_stage INTO cur_stage
  FROM public.referrals
  WHERE referred_user_id = p_user_id
  LIMIT 1;

  IF cur_stage IS NULL THEN
    RETURN;
  END IF;

  IF cur_stage IN ('hired', 'paid') THEN
    RETURN;
  END IF;

  new_stage := 'signed_up';

  IF EXISTS (SELECT 1 FROM public.applications a WHERE a.user_id = p_user_id LIMIT 1) THEN
    new_stage := 'application_started';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.user_id = p_user_id
      AND a.canonical_stage IS NOT NULL
      AND a.canonical_stage IN (
        'submitted',
        'interview',
        'offer',
        'rejected',
        'withdrawn',
        'failed',
        'terminated'
      )
  ) THEN
    new_stage := 'application_completed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.user_id = p_user_id
      AND (a.canonical_stage = 'offer' OR a.status = 'Offer')
  ) THEN
    new_stage := 'offer_extended';
  END IF;

  cur_rank := public.referral_stage_rank(cur_stage);
  new_rank := public.referral_stage_rank(new_stage);

  IF new_rank > cur_rank THEN
    UPDATE public.referrals
    SET funnel_stage = new_stage, updated_at = now()
    WHERE referred_user_id = p_user_id;
  END IF;
END;
$$;
