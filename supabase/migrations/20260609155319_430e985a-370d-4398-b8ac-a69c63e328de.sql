-- 1. Harden internal.is_kubo_admin()
CREATE OR REPLACE FUNCTION internal.is_kubo_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.role() = 'service_role') OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Harden public.notify_creative_status_change()
CREATE OR REPLACE FUNCTION public.notify_creative_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only execute if it's a relevant status change
  IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('completed', 'failed', 'cancelled', 'error')) THEN
    PERFORM
      net.http_post(
        url := (SELECT value FROM settings WHERE key = 'supabase_url') || '/functions/v1/creative-status-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM settings WHERE key = 'service_role_key')
        ),
        body := jsonb_build_object(
          'asset_id', NEW.id,
          'user_id', NEW.user_id,
          'status', NEW.status,
          'tool', NEW.tool
        )
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Refactor public.get_creative_audit_logs() to be secure and prevent SQL injection
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
  v_is_admin BOOLEAN;
  v_allowed_tables TEXT[] := ARRAY['creative_export_audit_log', 'creative_audit_trail'];
BEGIN
  -- 1. Whitelist validation
  IF NOT (p_table = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Unauthorized table: %', p_table;
  END IF;

  -- 2. Admin check
  v_is_admin := internal.is_kubo_admin();

  -- 3. Build query with strict parameterization where possible, and whitelisted identifiers
  -- We use %I for whitelisted identifiers and %L for values
  v_query := format(
    'SELECT jsonb_agg(t) FROM (
      SELECT l.*, p.email as profile_email 
      FROM %I l
      LEFT JOIN profiles p ON l.user_id = p.id
      WHERE l.%I = %L',
    p_table, p_id_field, p_id_value
  );

  -- 4. Access control: If not admin, ensure user can only see their own logs
  -- Note: We check user_id on the record itself
  IF NOT v_is_admin THEN
    v_query := v_query || format(' AND l.user_id = %L', auth.uid());
  END IF;

  -- 5. Additional filters
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Log the audit actions
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('security_definer_hardening_v2', 'function', 'all', true, '{"hardened_functions": ["is_kubo_admin", "notify_creative_status_change", "get_creative_audit_logs"], "fix": "search_path_and_sql_injection_protection"}');