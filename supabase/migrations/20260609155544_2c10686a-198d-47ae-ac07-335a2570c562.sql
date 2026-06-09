-- 1. Drop and recreate public functions to switch to SECURITY INVOKER
DROP FUNCTION IF EXISTS public.get_my_referral_code();
DROP FUNCTION IF EXISTS public.find_referrer_by_code(text);
DROP FUNCTION IF EXISTS public.get_creative_audit_logs(text, text, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS text AS $$
  SELECT referral_code FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.find_referrer_by_code(_code text)
RETURNS text AS $$
  SELECT id::text FROM public.profiles WHERE referral_code = _code LIMIT 1;
$$ LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp;

-- 2. Harden internal functions with SET search_path (using correct signatures)
ALTER FUNCTION internal.is_kubo_admin() SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.is_skill_admin() SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.is_admin(uuid) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.admin_list_connector_runs(text, integer) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.admin_clear_connector_run(text, text) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.grant_credits(uuid, numeric) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.enqueue_email(text, jsonb) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.delete_email(text, bigint) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.read_email_batch(text, integer, integer) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.bump_rate_limit(text, uuid, integer) SET search_path = public, internal, pg_temp;
ALTER FUNCTION internal.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) SET search_path = public, internal, pg_temp;

-- 3. Add Admin RLS policies for audit logs
CREATE POLICY "Admins can view all audit trail" 
ON public.creative_audit_trail FOR SELECT 
USING (internal.is_kubo_admin());

CREATE POLICY "Admins can view all export audit logs" 
ON public.creative_export_audit_log FOR SELECT 
USING (internal.is_kubo_admin());

-- 4. Recreate get_creative_audit_logs as SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.get_creative_audit_logs(
  p_table TEXT,
  p_id_field TEXT,
  p_id_value UUID,
  p_search TEXT DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_query TEXT;
  v_results JSONB;
  v_allowed_tables TEXT[] := ARRAY['creative_export_audit_log', 'creative_audit_trail'];
BEGIN
  -- 1. Whitelist validation (identifiers)
  IF NOT (p_table = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Unauthorized table: %', p_table;
  END IF;

  -- 2. Build query with whitelisted identifiers and parameterized values
  v_query := format(
    'SELECT jsonb_agg(t) FROM (
      SELECT l.*, p.email as profile_email 
      FROM %I l
      LEFT JOIN profiles p ON l.user_id = p.id
      WHERE l.%I = %L',
    p_table, p_id_field, p_id_value
  );

  -- 3. Additional filters
  IF p_search IS NOT NULL AND p_search <> '' THEN
    IF p_table = 'creative_export_audit_log' THEN
      v_query := v_query || format(' AND (l.action ILIKE %L OR l.details->>''reason'' ILIKE %L OR l.details->>''error'' ILIKE %L)', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    ELSE
      v_query := v_query || format(' AND (l.action ILIKE %L OR l.params->>''reason'' ILIKE %L OR l.params->>''error'' ILIKE %L)', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    END IF;
  END IF;

  IF p_start_date IS NOT NULL AND p_start_date <> '' THEN
    v_query := v_query || format(' AND l.created_at >= %L', p_start_date);
  END IF;

  IF p_end_date IS NOT NULL AND p_end_date <> '' THEN
    v_query := v_query || format(' AND l.created_at <= %L', p_end_date);
  END IF;

  v_query := v_query || ' ORDER BY l.created_at DESC) t';

  EXECUTE v_query INTO v_results;
  RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp;

-- 5. Audit log
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('security_hardening_invoker_v4', 'function', 'all', true, '{"converted_to_invoker": ["get_my_referral_code", "find_referrer_by_code", "get_creative_audit_logs"], "hardened_search_path": ["internal_functions"]}');