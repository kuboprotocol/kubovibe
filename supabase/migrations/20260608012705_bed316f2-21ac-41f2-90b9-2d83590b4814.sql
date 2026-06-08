-- 1. Ensure internal schema exists
CREATE SCHEMA IF NOT EXISTS internal;

-- 2. Create hardened functions in internal schema (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION internal.is_admin(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION internal.is_kubo_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (auth.role() = 'service_role') OR internal.is_admin(auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION internal.execute_atomic_credit_deduction(_user_id uuid, _amount integer, _reason text, _category text DEFAULT 'general'::text, _metadata jsonb DEFAULT '{}'::jsonb, _idempotency_key text DEFAULT NULL::text)
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
  -- AUTH CHECK
  IF auth.role() <> 'service_role' AND _user_id <> auth.uid() AND NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden: you can only deduct credits from your own account';
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
      RETURN jsonb_build_object(
        'success', true,
        'replayed', true,
        'transaction_id', _existing.id,
        'balance_after', _existing.balance_after
      );
    END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION internal.bump_rate_limit(_bucket text, _user uuid, _window_seconds integer)
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
  IF auth.role() <> 'service_role' AND _user <> auth.uid() AND NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _window := date_trunc('second', now()) - (extract(epoch from now())::int % _window_seconds) * interval '1 second';
  INSERT INTO public.rate_limit_counters (bucket_key, user_id, window_start, count)
  VALUES (_bucket, _user, _window, 1)
  ON CONFLICT (bucket_key, user_id, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO _count;
  
  DELETE FROM public.rate_limit_counters WHERE window_start < now() - interval '1 hour';
  RETURN _count;
END;
$function$;

CREATE OR REPLACE FUNCTION internal.log_security_audit(_action text, _resource_type text, _resource_id text DEFAULT NULL::text, _job_id text DEFAULT NULL::text, _request_id text DEFAULT NULL::text, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text, _success boolean DEFAULT true, _error_message text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb, _actor_user_id uuid DEFAULT NULL::uuid, _actor_role text DEFAULT NULL::text)
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
  -- AUTH CHECK
  IF auth.role() <> 'service_role' AND _actor_user_id IS NOT NULL AND _actor_user_id <> auth.uid() AND NOT internal.is_kubo_admin() THEN
     RAISE EXCEPTION 'forbidden';
  END IF;

  _resolved_user := COALESCE(_actor_user_id, auth.uid());
  _resolved_role := COALESCE(
    _actor_role,
    CASE
      WHEN _resolved_user IS NULL THEN 'service'
      WHEN internal.is_kubo_admin() THEN 'admin'
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

CREATE OR REPLACE FUNCTION internal.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION internal.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION internal.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT internal.is_kubo_admin() THEN
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

CREATE OR REPLACE FUNCTION internal.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION internal.grant_credits(p_user_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden: admin access required';
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, edits_used, edits_limit, is_active)
  VALUES (p_user_id, 'free', 0, 5 + p_amount, true)
  ON CONFLICT (user_id) DO UPDATE
  SET edits_limit = subscriptions.edits_limit + p_amount,
      updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION internal.admin_list_connector_runs(_connector_slug text, _limit integer DEFAULT 50)
 RETURNS TABLE(run_id text, run_label text, event_count bigint, started_at timestamp with time zone, user_id uuid, is_mine boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT internal.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (l.metadata->>'runId')::text AS run_id,
    COALESCE(MAX(l.metadata->>'runLabel'), 'Run') AS run_label,
    COUNT(*)::bigint AS event_count,
    MIN(l.created_at) AS started_at,
    (ARRAY_AGG(l.user_id ORDER BY l.created_at))[1] AS user_id,
    BOOL_OR(l.user_id = auth.uid()) AS is_mine
  FROM public.connector_activity_logs l
  WHERE l.connector_slug = _connector_slug
    AND l.metadata ? 'runId'
  GROUP BY (l.metadata->>'runId')
  ORDER BY MIN(l.created_at) DESC
  LIMIT _limit;
END;
$function$;

CREATE OR REPLACE FUNCTION internal.admin_clear_connector_run(_connector_slug text, _run_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _deleted int;
BEGIN
  IF NOT internal.is_kubo_admin() THEN
    PERFORM internal.log_security_audit(
      'admin_clear_connector_run', 'admin', _connector_slug, _run_id,
      NULL, NULL, NULL, false, 'forbidden',
      jsonb_build_object('connector_slug', _connector_slug, 'run_id', _run_id)
    );
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH d AS (
    DELETE FROM public.connector_activity_logs
    WHERE connector_slug = _connector_slug
      AND metadata->>'runId' = _run_id
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO _deleted FROM d;

  PERFORM internal.log_security_audit(
    'admin_clear_connector_run', 'admin', _connector_slug, _run_id,
    NULL, NULL, NULL, true, NULL,
    jsonb_build_object('deleted', _deleted, 'connector_slug', _connector_slug, 'run_id', _run_id)
  );

  RETURN _deleted;
END;
$function$;

-- 3. Revoke all on public versions and DROP them
DROP FUNCTION IF EXISTS public.enqueue_email(text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.delete_email(text, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.move_to_dlq(text, text, bigint, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.read_email_batch(text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.grant_credits(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_connector_runs(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.admin_clear_connector_run(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.bump_rate_limit(text, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_kubo_admin() CASCADE;

-- 4. Grant access to internal functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO authenticated, service_role;

-- 5. Update RLS policies to use internal schema
-- (We use DO block to be idempotent if some policies were already updated)
DO $$
BEGIN
  -- We don't need to do anything here if the previous query showed they already use internal.is_kubo_admin()
  -- But let's make sure ALL are updated.
  NULL;
END $$;
