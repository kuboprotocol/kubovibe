-- 1. Remove redundant public function
DROP FUNCTION IF EXISTS public.is_kubo_admin();

-- 2. Revoke execute on trigger function (only needed by the trigger itself)
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM anon;

-- 3. Revoke execute on internal utility function from public roles
-- It should only be called by other functions with proper permissions
REVOKE EXECUTE ON FUNCTION internal.is_kubo_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.is_kubo_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION internal.is_kubo_admin() FROM anon;

-- 4. Audit log
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('security_definer_cleanup', 'function', 'all', true, '{"dropped": ["public.is_kubo_admin"], "revoked_execute": ["notify_creative_status_change", "internal.is_kubo_admin"]}');