-- Fix search_path and public execute for get_creative_audit_logs
ALTER FUNCTION get_creative_audit_logs(TEXT, TEXT, UUID, TEXT, TEXT, TEXT) SET search_path = public;
REVOKE EXECUTE ON FUNCTION get_creative_audit_logs(TEXT, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_creative_audit_logs(TEXT, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Ensure table and column validation inside the function for safety
CREATE OR REPLACE FUNCTION get_creative_audit_logs(
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
BEGIN
  -- Validate table name to prevent SQL injection
  IF p_table NOT IN ('creative_export_audit_log', 'creative_audit_logs') THEN
    RAISE EXCEPTION 'Invalid table name';
  END IF;

  -- Validate field name
  IF p_id_field NOT IN ('export_id', 'asset_id') THEN
    RAISE EXCEPTION 'Invalid field name';
  END IF;

  v_query := format(
    'SELECT jsonb_agg(t) FROM (
      SELECT l.*, p.email as profile_email 
      FROM %I l
      LEFT JOIN profiles p ON l.user_id = p.id
      WHERE l.%I = %L',
    p_table, p_id_field, p_id_value
  );

  IF p_search IS NOT NULL AND p_search <> '' THEN
    IF p_table = 'creative_export_audit_log' THEN
      v_query := v_query || format(' AND (l.action ILIKE %L OR l.details->>''reason'' ILIKE %L OR l.details->>''error'' ILIKE %L)', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    ELSE
      v_query := v_query || format(' AND (l.event_type ILIKE %L OR l.metadata->>''reason'' ILIKE %L OR l.metadata->>''error'' ILIKE %L)', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;