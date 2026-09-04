CREATE OR REPLACE FUNCTION internal.execute_atomic_credit_topup(
  _user_id uuid,
  _amount integer,
  _reason text,
  _category text DEFAULT 'billing',
  _metadata jsonb DEFAULT '{}'::jsonb,
  _idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'internal', 'pg_temp'
AS $function$
DECLARE
  _sub RECORD;
  _balance_after INTEGER;
  _tx_id UUID;
  _existing RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT id, balance_after INTO _existing
    FROM public.credit_transactions
    WHERE user_id = _user_id AND idempotency_key = _idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'replayed', true, 'transaction_id', _existing.id, 'balance_after', _existing.balance_after);
    END IF;
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found';
  END IF;

  UPDATE public.subscriptions
  SET edits_limit = edits_limit + _amount, updated_at = now()
  WHERE id = _sub.id;

  _balance_after := (_sub.edits_limit + _amount) - _sub.edits_used;

  INSERT INTO public.credit_transactions (user_id, delta, balance_after, reason, category, metadata, idempotency_key)
  VALUES (_user_id, _amount, _balance_after, _reason, _category, _metadata, _idempotency_key)
  RETURNING id INTO _tx_id;

  RETURN jsonb_build_object('success', true, 'replayed', false, 'transaction_id', _tx_id, 'balance_after', _balance_after);
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_atomic_credit_topup(
  _user_id uuid,
  _amount integer,
  _reason text,
  _category text DEFAULT 'billing',
  _metadata jsonb DEFAULT '{}'::jsonb,
  _idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public'
AS $function$ SELECT internal.execute_atomic_credit_topup(_user_id, _amount, _reason, _category, _metadata, _idempotency_key); $function$;

REVOKE EXECUTE ON FUNCTION public.execute_atomic_credit_topup(uuid, integer, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_atomic_credit_topup(uuid, integer, text, text, jsonb, text) TO service_role;