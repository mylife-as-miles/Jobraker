-- Forward-only hotfix for the unified model and Composio AI allowance ledger.

ALTER TABLE public.internal_provider_pricing
  ADD COLUMN IF NOT EXISTS provider_cost_nanos BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billable_cost_nanos BIGINT NOT NULL DEFAULT 0;

UPDATE public.internal_provider_pricing
SET provider_cost_nanos = 0,
    billable_cost_nanos = CASE usage_class
      WHEN 'standard' THEN 299000
      WHEN 'pro' THEN 897000
      ELSE billable_cost_nanos
    END,
    metadata = metadata || jsonb_build_object('pricing_review_due', '2026-08-15')
WHERE provider = 'composio';

CREATE TABLE IF NOT EXISTS public.composio_tool_classifications (
  toolkit_slug TEXT NOT NULL,
  tool_slug TEXT NOT NULL,
  call_class TEXT NOT NULL CHECK (call_class IN ('standard', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (toolkit_slug, tool_slug)
);
ALTER TABLE public.composio_tool_classifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.composio_tool_classifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.composio_tool_classifications TO service_role;
INSERT INTO public.composio_tool_classifications (toolkit_slug, tool_slug, call_class) VALUES
  ('gmail', 'GMAIL_FETCH_EMAILS', 'standard'),
  ('gmail', 'GMAIL_GET_THREAD', 'standard'),
  ('gmail', 'GMAIL_SEARCH_EMAILS', 'standard'),
  ('gmail', 'GMAIL_CREATE_DRAFT', 'pro'),
  ('gmail', 'GMAIL_SEND_EMAIL', 'pro')
ON CONFLICT (toolkit_slug, tool_slug) DO NOTHING;

CREATE OR REPLACE VIEW public.user_combined_ai_usage_events AS
SELECT user_id,created_at,billable_cost_nanos,reserved_cost_nanos,status,billable,reservation_expires_at,'model' AS usage_source,request_id FROM public.ai_usage_events
UNION ALL
SELECT user_id,created_at,billable_cost_nanos,reserved_cost_nanos,status,billable,reservation_expires_at,'integration' AS usage_source,request_id FROM public.composio_usage_events;

-- Hardened model reservation with only its window sums widened to the combined view.
CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
  p_user_id UUID, p_request_id UUID, p_feature_key TEXT, p_provider TEXT, p_model TEXT,
  p_estimated_cost_nanos BIGINT, p_parent_request_id UUID DEFAULT NULL,
  p_payload_hash TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_existing RECORD; v_tier TEXT; v_period RECORD; v_now TIMESTAMPTZ := now();
  v_ttl INTEGER := 900; v_expires TIMESTAMPTZ; v_month BIGINT := 0; v_week BIGINT := 0; v_day BIGINT := 0;
  v_month_limit BIGINT; v_week_limit BIGINT; v_day_limit BIGINT;
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
      RETURN jsonb_build_object('success',false,'error','INVALID_REQUEST_ID_REUSE','status',v_existing.status);
    END IF;
    IF v_existing.status='reserved' AND v_existing.reservation_expires_at > v_now THEN
      RETURN jsonb_build_object('success',false,'error','AI_REQUEST_IN_PROGRESS','status','reserved','request_id',p_request_id);
    ELSIF v_existing.status='reserved' THEN
      UPDATE public.ai_usage_events SET status='released', billable=false, reserved_cost_nanos=0,
        reservation_expires_at=NULL, released_at=v_now, metadata=metadata||jsonb_build_object('release_reason','reservation_expired') WHERE id=v_existing.id;
      RETURN jsonb_build_object('success',false,'error','AI_REQUEST_EXPIRED','status','released','request_id',p_request_id);
    END IF;
    RETURN jsonb_build_object('success',false,'error','AI_REQUEST_ALREADY_COMPLETED','status',v_existing.status,'request_id',p_request_id);
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
    RETURN jsonb_build_object('success',false,'error','AI_USAGE_LIMIT_REACHED','available_nanos',least(greatest(0,v_day_limit-v_day),greatest(0,v_week_limit-v_week),greatest(0,v_month_limit-v_month)));
  END IF;
  INSERT INTO public.ai_usage_events (user_id,request_id,feature_key,provider,model,input_tokens,output_tokens,total_tokens,input_cost_nanos,output_cost_nanos,total_cost_nanos,provider_cost_nanos,estimated_provider_cost_nanos,billable_cost_nanos,reserved_cost_nanos,billable,status,parent_request_id,payload_hash,usage_source,provider_usage_confirmed,metadata,reservation_expires_at,created_at)
  VALUES(p_user_id,p_request_id,p_feature_key,p_provider,p_model,0,0,0,0,0,0,0,0,0,p_estimated_cost_nanos,true,'reserved',p_parent_request_id,p_payload_hash,'provider',false,p_metadata,v_expires,v_now);
  RETURN jsonb_build_object('success',true,'idempotent',false,'request_id',p_request_id,'status','reserved','reserved_cost_nanos',p_estimated_cost_nanos,'available_nanos',least(v_day_limit-v_day,v_week_limit-v_week,v_month_limit-v_month),'expires_at',v_expires);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp;

CREATE OR REPLACE FUNCTION public.reserve_composio_usage(p_user_id UUID,p_request_id UUID,p_toolkit_slug TEXT,p_tool_slug TEXT,p_parent_request_id UUID DEFAULT NULL,p_payload_hash TEXT DEFAULT NULL,p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB AS $$
DECLARE v_existing RECORD; v_class TEXT; v_weight BIGINT; v_now TIMESTAMPTZ:=now(); v_tier TEXT; v_period RECORD; v_m BIGINT:=0;v_w BIGINT:=0;v_d BIGINT:=0;v_ml BIGINT;v_wl BIGINT;v_dl BIGINT;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR coalesce(p_toolkit_slug,'')='' OR coalesce(p_tool_slug,'')='' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_RESERVATION_INPUT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0)); PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.composio_usage_events WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.toolkit_slug IS DISTINCT FROM p_toolkit_slug OR v_existing.tool_slug IS DISTINCT FROM p_tool_slug OR v_existing.payload_hash IS DISTINCT FROM p_payload_hash THEN RETURN jsonb_build_object('success',false,'error','INVALID_REQUEST_ID_REUSE','status',v_existing.status); END IF;
    IF v_existing.status='reserved' AND v_existing.reservation_expires_at>v_now THEN RETURN jsonb_build_object('success',false,'error','AI_REQUEST_IN_PROGRESS','status','reserved','request_id',p_request_id); END IF;
    IF v_existing.status='reserved' THEN UPDATE public.composio_usage_events SET status='released',billable=false,reserved_cost_nanos=0,reservation_expires_at=NULL,released_at=v_now,metadata=metadata||jsonb_build_object('release_reason','reservation_expired') WHERE id=v_existing.id; RETURN jsonb_build_object('success',false,'error','AI_REQUEST_EXPIRED','status','released'); END IF;
    RETURN jsonb_build_object('success',false,'error','AI_REQUEST_ALREADY_COMPLETED','status',v_existing.status,'request_id',p_request_id);
  END IF;
  SELECT call_class INTO v_class FROM public.composio_tool_classifications WHERE toolkit_slug=p_toolkit_slug AND tool_slug=p_tool_slug; v_class:=coalesce(v_class,'pro');
  SELECT billable_cost_nanos INTO v_weight FROM public.internal_provider_pricing WHERE provider='composio' AND usage_class=v_class; v_weight:=coalesce(v_weight,897000);
  v_tier:=public.get_user_tier(p_user_id); SELECT monthly_allowance_nanos,weekly_allowance_nanos,rolling_24h_allowance_nanos INTO v_ml,v_wl,v_dl FROM public.get_ai_tier_limits(v_tier); SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);
  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_m FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND billable AND(status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_period.current_period_start AND created_at<v_period.current_period_end;
  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_w FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND billable AND(status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_period.weekly_window_start AND created_at<v_period.weekly_window_end;
  SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_d FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND billable AND(status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_now-interval '24 hours';
  IF least(v_ml-v_m,v_wl-v_w,v_dl-v_d)<v_weight THEN RETURN jsonb_build_object('success',false,'error','AI_USAGE_LIMIT_REACHED'); END IF;
  INSERT INTO public.composio_usage_events(user_id,request_id,parent_request_id,toolkit_slug,tool_slug,call_class,reserved_cost_nanos,billable_cost_nanos,provider_cost_nanos,billable,status,payload_hash,reservation_expires_at,metadata) VALUES(p_user_id,p_request_id,p_parent_request_id,p_toolkit_slug,p_tool_slug,v_class,v_weight,0,0,true,'reserved',p_payload_hash,v_now+interval '5 minutes',p_metadata);
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','reserved','request_id',p_request_id,'call_class',v_class,'reserved_cost_nanos',v_weight);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp;

CREATE OR REPLACE FUNCTION public.settle_composio_usage(p_user_id UUID,p_request_id UUID,p_tool_slug TEXT,p_execution_id TEXT DEFAULT NULL,p_composio_log_id TEXT DEFAULT NULL,p_session_id TEXT DEFAULT NULL,p_connected_account_id TEXT DEFAULT NULL,p_call_class TEXT DEFAULT NULL,p_provider_cost_nanos BIGINT DEFAULT 0,p_billable BOOLEAN DEFAULT true,p_failure_owner TEXT DEFAULT NULL,p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB AS $$
DECLARE v_event RECORD;v_now TIMESTAMPTZ:=now();v_class TEXT;v_weight BIGINT:=0;v_m BIGINT:=0;v_w BIGINT:=0;v_d BIGINT:=0;v_tier TEXT;v_period RECORD;v_ml BIGINT;v_wl BIGINT;v_dl BIGINT;v_bill BIGINT:=0;
BEGIN
  IF p_provider_cost_nanos<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PROVIDER_COST'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0)); PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  SELECT * INTO v_event FROM public.composio_usage_events WHERE user_id=p_user_id AND request_id=p_request_id AND tool_slug=p_tool_slug FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','MISSING_RESERVATION'); END IF;
  IF v_event.status IN ('settled','failed') THEN
    IF v_event.billable IS NOT DISTINCT FROM p_billable AND v_event.provider_cost_nanos=p_provider_cost_nanos THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status',v_event.status,'provider_cost_nanos',v_event.provider_cost_nanos,'billable_cost_nanos',v_event.billable_cost_nanos); END IF;
    RETURN jsonb_build_object('success',false,'error','SETTLEMENT_IDEMPOTENCY_MISMATCH','status',v_event.status);
  END IF;
  IF v_event.status<>'reserved' THEN RETURN jsonb_build_object('success',false,'error','RESERVATION_NOT_SETTLEABLE','status',v_event.status); END IF;
  IF v_event.reservation_expires_at IS NULL OR v_event.reservation_expires_at<=v_now THEN RETURN jsonb_build_object('success',false,'error','EXPIRED_RESERVATION','status','reserved'); END IF;
  v_class:=v_event.call_class; SELECT billable_cost_nanos INTO v_weight FROM public.internal_provider_pricing WHERE provider='composio' AND usage_class=v_class; v_weight:=coalesce(v_weight,v_event.reserved_cost_nanos);
  IF p_billable THEN
    v_tier:=public.get_user_tier(p_user_id); SELECT monthly_allowance_nanos,weekly_allowance_nanos,rolling_24h_allowance_nanos INTO v_ml,v_wl,v_dl FROM public.get_ai_tier_limits(v_tier); SELECT * INTO v_period FROM public.get_user_billing_period(p_user_id);
    SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_m FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND NOT (usage_source='integration' AND request_id=p_request_id) AND billable AND(status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_period.current_period_start AND created_at<v_period.current_period_end;
    SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_w FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND NOT (usage_source='integration' AND request_id=p_request_id) AND billable AND(status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_period.weekly_window_start AND created_at<v_period.weekly_window_end;
    SELECT coalesce(sum(CASE WHEN status='settled' THEN billable_cost_nanos ELSE reserved_cost_nanos END),0) INTO v_d FROM public.user_combined_ai_usage_events WHERE user_id=p_user_id AND NOT (usage_source='integration' AND request_id=p_request_id) AND billable AND(status='settled' OR(status='reserved' AND reservation_expires_at>v_now)) AND created_at>=v_now-interval '24 hours';
    v_bill:=least(v_weight,greatest(0,least(v_ml-v_m,v_wl-v_w,v_dl-v_d)));
  END IF;
  UPDATE public.composio_usage_events SET status=CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,billable=p_billable,provider_cost_nanos=p_provider_cost_nanos,billable_cost_nanos=v_bill,reserved_cost_nanos=0,failure_owner=p_failure_owner,execution_id=coalesce(p_execution_id,execution_id),composio_log_id=coalesce(p_composio_log_id,composio_log_id),session_id=coalesce(p_session_id,session_id),connected_account_id=coalesce(p_connected_account_id,connected_account_id),settled_at=v_now,reservation_expires_at=NULL,metadata=metadata||p_metadata||jsonb_build_object('server_call_class',v_class) WHERE id=v_event.id;
  RETURN jsonb_build_object('success',true,'status',CASE WHEN p_billable THEN 'settled' ELSE 'failed' END,'provider_cost_nanos',p_provider_cost_nanos,'billable_cost_nanos',v_bill);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp;

CREATE OR REPLACE FUNCTION public.release_composio_usage(p_user_id UUID,p_request_id UUID,p_tool_slug TEXT DEFAULT NULL,p_reason TEXT DEFAULT NULL) RETURNS JSONB AS $$
DECLARE v_event RECORD;v_now TIMESTAMPTZ:=now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO v_event FROM public.composio_usage_events WHERE user_id=p_user_id AND request_id=p_request_id AND (p_tool_slug IS NULL OR tool_slug=p_tool_slug) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','MISSING_RESERVATION'); END IF;
  IF v_event.status='released' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status','released'); END IF;
  IF v_event.status<>'reserved' THEN RETURN jsonb_build_object('success',false,'error','RESERVATION_NOT_RELEASABLE','status',v_event.status); END IF;
  UPDATE public.composio_usage_events SET status='released',billable=false,reserved_cost_nanos=0,billable_cost_nanos=0,released_at=v_now,reservation_expires_at=NULL,metadata=metadata||jsonb_build_object('release_reason',p_reason) WHERE id=v_event.id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','released');
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid,uuid,text,text,text,bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid,uuid,text,text,text,bigint,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_composio_usage(uuid,uuid,text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_composio_usage(uuid,uuid,text,text,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.settle_composio_usage(uuid,uuid,text,text,text,text,text,text,bigint,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_composio_usage(uuid,uuid,text,text,text,text,text,text,bigint,boolean,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.release_composio_usage(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_composio_usage(uuid,uuid,text,text) TO service_role;
