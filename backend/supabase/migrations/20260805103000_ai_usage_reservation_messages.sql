-- Return actionable, user-safe reservation details for the Edge Function.
CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
  p_user_id UUID, p_request_id UUID, p_feature_key TEXT, p_provider TEXT, p_model TEXT,
  p_estimated_cost_nanos BIGINT, p_parent_request_id UUID DEFAULT NULL,
  p_payload_hash TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_existing RECORD; v_tier TEXT; v_period RECORD; v_now TIMESTAMPTZ := now();
  v_ttl INTEGER := 900; v_expires TIMESTAMPTZ; v_month BIGINT := 0; v_week BIGINT := 0; v_day BIGINT := 0;
  v_month_limit BIGINT; v_week_limit BIGINT; v_day_limit BIGINT; v_window TEXT;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_estimated_cost_nanos < 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_RESERVATION_INPUT';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.ai_usage_events WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.feature_key IS DISTINCT FROM p_feature_key OR v_existing.provider IS DISTINCT FROM p_provider
       OR v_existing.model IS DISTINCT FROM p_model OR v_existing.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('success',false,'error','INVALID_REQUEST_ID_REUSE','status',v_existing.status,'message','This request cannot be reused with different content.');
    END IF;
    IF v_existing.status='reserved' AND v_existing.reservation_expires_at > v_now THEN
      RETURN jsonb_build_object('success',false,'error','AI_REQUEST_IN_PROGRESS','status','reserved','request_id',p_request_id,'message','This AI request is already in progress.');
    ELSIF v_existing.status='reserved' THEN
      UPDATE public.ai_usage_events SET status='released', billable=false, reserved_cost_nanos=0,
        reservation_expires_at=NULL, released_at=v_now, metadata=metadata||jsonb_build_object('release_reason','reservation_expired') WHERE id=v_existing.id;
      RETURN jsonb_build_object('success',false,'error','AI_REQUEST_EXPIRED','status','released','request_id',p_request_id,'message','This AI request expired before it could start.');
    END IF;
    RETURN jsonb_build_object('success',false,'error','AI_REQUEST_ALREADY_COMPLETED','status',v_existing.status,'request_id',p_request_id,'message','This AI request has already completed.');
  END IF;
  IF p_metadata ? 'reservation_ttl_seconds' AND (p_metadata->>'reservation_ttl_seconds') ~ '^[0-9]+$' THEN
    v_ttl := least(1800,greatest(300,(p_metadata->>'reservation_ttl_seconds')::integer));
  END IF;
  v_expires := v_now + make_interval(secs=>v_ttl); v_tier:=public.get_user_tier(p_user_id);
  SELECT monthly_allowance_nanos,weekly_allowance_nanos,rolling_24h_allowance_nanos INTO v_month_limit,v_week_limit,v_day_limit FROM public.get_ai_tier_limits(v_tier);
  SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);
  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_month FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND billable AND (status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_period.current_period_start AND created_at<v_period.current_period_end;
  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_week FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND billable AND (status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_period.weekly_window_start AND created_at<v_period.weekly_window_end;
  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_day FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND billable AND (status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_now-interval '24 hours';
  IF v_day_limit-v_day<p_estimated_cost_nanos OR v_week_limit-v_week<p_estimated_cost_nanos OR v_month_limit-v_month<p_estimated_cost_nanos THEN
    v_window := CASE WHEN v_day_limit-v_day<p_estimated_cost_nanos THEN 'rolling_24h' WHEN v_week_limit-v_week<p_estimated_cost_nanos THEN 'weekly' ELSE 'monthly' END;
    RETURN jsonb_build_object('success',false,'error','AI_USAGE_LIMIT_REACHED','message','You’ve reached your AI usage limit for now. It becomes available again as your allowance rolls forward.','window',v_window,'resetsAt',NULL,'resetsGradually',v_window='rolling_24h','available_nanos',least(greatest(0,v_day_limit-v_day),greatest(0,v_week_limit-v_week),greatest(0,v_month_limit-v_month)));
  END IF;
  INSERT INTO public.ai_usage_events (user_id,request_id,feature_key,provider,model,input_tokens,output_tokens,total_tokens,input_cost_nanos,output_cost_nanos,total_cost_nanos,provider_cost_nanos,estimated_provider_cost_nanos,billable_cost_nanos,reserved_cost_nanos,billable,status,parent_request_id,payload_hash,usage_source,provider_usage_confirmed,metadata,reservation_expires_at,created_at)
  VALUES(p_user_id,p_request_id,p_feature_key,p_provider,p_model,0,0,0,0,0,0,0,0,0,p_estimated_cost_nanos,true,'reserved',p_parent_request_id,p_payload_hash,'provider',false,p_metadata,v_expires,v_now);
  RETURN jsonb_build_object('success',true,'idempotent',false,'request_id',p_request_id,'status','reserved','reserved_cost_nanos',p_estimated_cost_nanos,'available_nanos',least(v_day_limit-v_day,v_week_limit-v_week,v_month_limit-v_month),'expires_at',v_expires);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid,uuid,text,text,text,bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid,uuid,text,text,text,bigint,uuid,text,jsonb) TO service_role;
