-- 1. Update is_kubo_admin to support service_role and be more robust
CREATE OR REPLACE FUNCTION public.is_kubo_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (auth.role() = 'service_role') OR public.is_admin(auth.uid());
END;
$function$;

-- 2. Harden execute_atomic_credit_deduction
CREATE OR REPLACE FUNCTION public.execute_atomic_credit_deduction(_user_id uuid, _amount integer, _reason text, _category text DEFAULT 'general'::text, _metadata jsonb DEFAULT '{}'::jsonb, _idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub RECORD;
  _balance_after INTEGER;
  _tx_id UUID;
  _existing RECORD;
BEGIN
  -- AUTH CHECK: Prevent users from deducting credits from others
  IF auth.role() <> 'service_role' AND _user_id <> auth.uid() AND NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden: you can only deduct credits from your own account';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  -- Idempotency: return previous tx if key was already used
  IF _idempotency_key IS NOT NULL THEN
    SELECT id, balance_after INTO _existing
    FROM public.credit_transactions
    WHERE user_id = _user_id AND idempotency_key = _idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'replayed', true,
        'transaction_id', _existing.id,
        'balance_after', _existing.balance_after
      );
    END IF;
  END IF;

  -- Lock subscription row to prevent races
  SELECT * INTO _sub
  FROM public.subscriptions
  WHERE user_id = _user_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found';
  END IF;

  IF (_sub.edits_limit - _sub.edits_used) < _amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE public.subscriptions
  SET edits_used = edits_used + _amount, updated_at = now()
  WHERE id = _sub.id;

  _balance_after := (_sub.edits_limit - (_sub.edits_used + _amount));

  INSERT INTO public.credit_transactions
    (user_id, delta, balance_after, reason, category, metadata, idempotency_key)
  VALUES
    (_user_id, -_amount, _balance_after, _reason, _category, _metadata, _idempotency_key)
  RETURNING id INTO _tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'replayed', false,
    'transaction_id', _tx_id,
    'balance_after', _balance_after
  );
END;
$function$;

-- 3. Harden bump_rate_limit
CREATE OR REPLACE FUNCTION public.bump_rate_limit(_bucket text, _user uuid, _window_seconds integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _window timestamptz;
  _count int;
BEGIN
  -- AUTH CHECK
  IF auth.role() <> 'service_role' AND _user <> auth.uid() AND NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _window := date_trunc('second', now()) - (extract(epoch from now())::int % _window_seconds) * interval '1 second';
  INSERT INTO public.rate_limit_counters (bucket_key, user_id, window_start, count)
  VALUES (_bucket, _user, _window, 1)
  ON CONFLICT (bucket_key, user_id, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO _count;
  
  -- limpa janelas antigas oportunisticamente
  DELETE FROM public.rate_limit_counters WHERE window_start < now() - interval '1 hour';
  RETURN _count;
END;
$function$;

-- 4. Harden log_security_audit
CREATE OR REPLACE FUNCTION public.log_security_audit(_action text, _resource_type text, _resource_id text DEFAULT NULL::text, _job_id text DEFAULT NULL::text, _request_id text DEFAULT NULL::text, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text, _success boolean DEFAULT true, _error_message text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb, _actor_user_id uuid DEFAULT NULL::uuid, _actor_role text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _id UUID;
  _resolved_user UUID;
  _resolved_role TEXT;
BEGIN
  -- AUTH CHECK: Prevent users from logging on behalf of others
  IF auth.role() <> 'service_role' AND _actor_user_id IS NOT NULL AND _actor_user_id <> auth.uid() AND NOT public.is_kubo_admin() THEN
     RAISE EXCEPTION 'forbidden';
  END IF;

  _resolved_user := COALESCE(_actor_user_id, auth.uid());
  _resolved_role := COALESCE(
    _actor_role,
    CASE
      WHEN _resolved_user IS NULL THEN 'service'
      WHEN public.is_kubo_admin() THEN 'admin'
      ELSE 'user'
    END
  );

  INSERT INTO public.security_audit_logs (
    actor_user_id, actor_role, action, resource_type, resource_id,
    job_id, request_id, ip_address, user_agent, success, error_message, metadata
  ) VALUES (
    _resolved_user, _resolved_role, _action, _resource_type, _resource_id,
    _job_id, _request_id, _ip, _user_agent, _success, _error_message, _metadata
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$;

-- 5. Harden PGMQ functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

-- 6. Permissions Revocation and Granting
-- Revoke PUBLIC execute on sensitive functions
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_connector_runs(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_clear_connector_run(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) FROM PUBLIC;

-- Grant access to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) TO authenticated, service_role;

-- 7. Column-level security for api_credentials
-- First, revoke all to start from clean state
REVOKE ALL ON public.api_credentials FROM PUBLIC, anon, authenticated;

-- Grant table-level access (required for RLS to evaluate policies)
GRANT SELECT, DELETE ON public.api_credentials TO authenticated;
GRANT ALL ON public.api_credentials TO service_role;

-- Specifically restrict SELECT to non-sensitive columns for authenticated users
-- In Postgres, if we grant column-level SELECT, it overrides table-level if revoked, 
-- but here we want to ensure they CANNOT see ciphertext/iv/tag.
-- The way to do this is to REVOKE select on those columns specifically if table-level was granted,
-- or just grant only the safe ones.
REVOKE SELECT ON public.api_credentials FROM authenticated;
GRANT SELECT (id, user_id, connector_slug, masked_hint, created_at, updated_at) ON public.api_credentials TO authenticated;
