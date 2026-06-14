
-- 1) profiles.referral_code: revoga SELECT da coluna para authenticated/anon
REVOKE SELECT (referral_code) ON public.profiles FROM authenticated;
REVOKE SELECT (referral_code) ON public.profiles FROM anon;
REVOKE SELECT (referral_code) ON public.profiles FROM PUBLIC;

-- 2) creative_export_audit_log: remove insert do usuário, restringe ao service_role
DROP POLICY IF EXISTS "Users can insert their own export audit logs" ON public.creative_export_audit_log;

DROP POLICY IF EXISTS "Service role writes export audit logs" ON public.creative_export_audit_log;
CREATE POLICY "Service role writes export audit logs"
  ON public.creative_export_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Deny client writes on export audit logs" ON public.creative_export_audit_log;
CREATE POLICY "Deny client writes on export audit logs"
  ON public.creative_export_audit_log
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- 3) creative_audit_trail: mesma estratégia
DROP POLICY IF EXISTS "Users can insert their own audit trail" ON public.creative_audit_trail;

DROP POLICY IF EXISTS "Service role writes audit trail" ON public.creative_audit_trail;
CREATE POLICY "Service role writes audit trail"
  ON public.creative_audit_trail
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Deny client writes on audit trail" ON public.creative_audit_trail;
CREATE POLICY "Deny client writes on audit trail"
  ON public.creative_audit_trail
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);
