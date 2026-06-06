
-- 1) Audit logs table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  actor_role TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  job_id TEXT,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Grants — only service_role writes; admins read via policy
GRANT SELECT ON public.security_audit_logs TO authenticated;
GRANT ALL ON public.security_audit_logs TO service_role;

-- 3) RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON public.security_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_kubo_admin());

CREATE POLICY "Users can view their own audit logs"
  ON public.security_audit_logs
  FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated — only service_role (bypasses RLS) writes.

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor ON public.security_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_job ON public.security_audit_logs(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action ON public.security_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_resource ON public.security_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created ON public.security_audit_logs(created_at DESC);

-- 5) Helper function callable from triggers, RPCs, and edge functions
CREATE OR REPLACE FUNCTION public.log_security_audit(
  _action TEXT,
  _resource_type TEXT,
  _resource_id TEXT DEFAULT NULL,
  _job_id TEXT DEFAULT NULL,
  _request_id TEXT DEFAULT NULL,
  _ip INET DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _success BOOLEAN DEFAULT true,
  _error_message TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb,
  _actor_user_id UUID DEFAULT NULL,
  _actor_role TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _resolved_user UUID;
  _resolved_role TEXT;
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.log_security_audit(TEXT, TEXT, TEXT, TEXT, TEXT, INET, TEXT, BOOLEAN, TEXT, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_audit(TEXT, TEXT, TEXT, TEXT, TEXT, INET, TEXT, BOOLEAN, TEXT, JSONB, UUID, TEXT) TO authenticated, service_role;

-- 6) Wrap existing admin RPCs to auto-log
CREATE OR REPLACE FUNCTION public.admin_clear_connector_run(_connector_slug text, _run_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted int;
BEGIN
  IF NOT public.is_kubo_admin() THEN
    PERFORM public.log_security_audit(
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

  PERFORM public.log_security_audit(
    'admin_clear_connector_run', 'admin', _connector_slug, _run_id,
    NULL, NULL, NULL, true, NULL,
    jsonb_build_object('deleted', _deleted, 'connector_slug', _connector_slug, 'run_id', _run_id)
  );

  RETURN _deleted;
END;
$$;
