
-- 1) Restringir SELECT na coluna auth_code (EPP) de kubo_domain_transfers
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM authenticated;
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM anon;
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM PUBLIC;

-- 2) Restringir SELECT em gmail_accounts.access_token_cache (plaintext token)
REVOKE SELECT (access_token_cache) ON public.gmail_accounts FROM authenticated;
REVOKE SELECT (access_token_cache) ON public.gmail_accounts FROM anon;
REVOKE SELECT (access_token_cache) ON public.gmail_accounts FROM PUBLIC;
REVOKE SELECT (access_token_expires_at) ON public.gmail_accounts FROM authenticated;
REVOKE SELECT (access_token_expires_at) ON public.gmail_accounts FROM anon;
REVOKE SELECT (access_token_expires_at) ON public.gmail_accounts FROM PUBLIC;

-- 3) security_audit_logs — policy explícita de write apenas para service_role
DROP POLICY IF EXISTS "Service role writes audit logs" ON public.security_audit_logs;
CREATE POLICY "Service role writes audit logs"
  ON public.security_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Bloquear INSERT/UPDATE/DELETE de qualquer client authenticated/anon
DROP POLICY IF EXISTS "Deny client writes on audit logs" ON public.security_audit_logs;
CREATE POLICY "Deny client writes on audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- 4) creative_export_history — policy explícita de write para service_role
DROP POLICY IF EXISTS "Service role manages export history" ON public.creative_export_history;
CREATE POLICY "Service role manages export history"
  ON public.creative_export_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Bloquear writes de clients
DROP POLICY IF EXISTS "Deny client writes on export history" ON public.creative_export_history;
CREATE POLICY "Deny client writes on export history"
  ON public.creative_export_history
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- 5) pwa_telemetry_audit_logs — policy explícita de write para service_role
DROP POLICY IF EXISTS "Service role manages pwa audit logs" ON public.pwa_telemetry_audit_logs;
CREATE POLICY "Service role manages pwa audit logs"
  ON public.pwa_telemetry_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Deny client writes on pwa audit logs" ON public.pwa_telemetry_audit_logs;
CREATE POLICY "Deny client writes on pwa audit logs"
  ON public.pwa_telemetry_audit_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);
