-- Allow admin (kuboprotocol@gmail.com) to load and delete connector logs by runId across all sessions/users.

CREATE OR REPLACE FUNCTION public.is_kubo_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = 'kuboprotocol@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_connector_runs(_connector_slug text, _limit int DEFAULT 50)
RETURNS TABLE(run_id text, run_label text, event_count bigint, started_at timestamptz, user_id uuid, is_mine boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_kubo_admin() THEN
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
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_connector_run(_connector_slug text, _run_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted int;
BEGIN
  IF NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH d AS (
    DELETE FROM public.connector_activity_logs
    WHERE connector_slug = _connector_slug
      AND metadata->>'runId' = _run_id
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO _deleted FROM d;

  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_connector_runs(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_clear_connector_run(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_connector_runs(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) TO authenticated;