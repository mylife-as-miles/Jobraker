-- check_credits_available previously queried credit_costs with feature_type = 'job',
-- but all migrations use feature_type = 'job_search' (feature_name 'search' | 'auto_apply').
-- A NULL cost made every pre-flight check fail regardless of balance.

CREATE OR REPLACE FUNCTION public.check_credits_available(
  p_user_id UUID,
  p_feature_type TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost_per_item INTEGER;
  v_total_cost INTEGER;
  v_current_balance INTEGER;
  v_credit_feature_type TEXT;
  v_credit_feature_name TEXT;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 0 THEN
    RETURN jsonb_build_object('available', false, 'message', 'Invalid quantity');
  END IF;

  IF p_feature_type = 'job_search' THEN
    v_credit_feature_type := 'job_search';
    v_credit_feature_name := 'search';
  ELSIF p_feature_type = 'auto_apply' THEN
    v_credit_feature_type := 'job_search';
    v_credit_feature_name := 'auto_apply';
  ELSE
    RETURN jsonb_build_object('available', false, 'message', 'Invalid feature type');
  END IF;

  SELECT cost INTO v_cost_per_item
  FROM public.credit_costs
  WHERE feature_type = v_credit_feature_type
    AND feature_name = v_credit_feature_name
    AND is_active = true;

  IF v_cost_per_item IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'message',
      'Credit cost for ' || v_credit_feature_type || '.' || v_credit_feature_name || ' not found'
    );
  END IF;

  v_total_cost := v_cost_per_item * p_quantity;

  SELECT balance INTO v_current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id;

  v_current_balance := COALESCE(v_current_balance, 0);

  IF v_current_balance >= v_total_cost THEN
    RETURN jsonb_build_object(
      'available', true,
      'required', v_total_cost,
      'current_balance', v_current_balance
    );
  END IF;

  RETURN jsonb_build_object(
    'available', false,
    'required', v_total_cost,
    'current_balance', v_current_balance,
    'shortfall', v_total_cost - v_current_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_credits_available(UUID, TEXT, INTEGER) TO authenticated;
