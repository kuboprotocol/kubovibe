-- 1. Fix search_path on internal functions
ALTER FUNCTION internal.is_kubo_admin() SET search_path = public, auth;

-- 2. Verify views are invoker-based (default in PG)
-- No changes needed to views themselves as I didn't specify SECURITY DEFINER.

-- 3. Audit log
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('linter_fix_search_path', 'database', 'internal', true, '{"functions": ["is_kubo_admin"]}');
