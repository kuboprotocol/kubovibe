-- 1. Hardening handle_new_user (Critical for registration flow)
ALTER FUNCTION public.handle_new_user() SET search_path = public, internal, auth;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;

-- 2. Hardening notify_creative_status_change (Internal status management)
ALTER FUNCTION public.notify_creative_status_change() SET search_path = public;
REVOKE ALL ON FUNCTION public.notify_creative_status_change() FROM PUBLIC, authenticated, anon;

-- 3. Verification and hardening of role helpers
ALTER FUNCTION public.has_role(text) SET search_path = public;
ALTER FUNCTION public.has_any_role(text[]) SET search_path = public;

-- Ensure they are strictly executable by authenticated users for RLS
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated, service_role;

-- 4. Secure referral code access
ALTER FUNCTION public.get_my_referral_code() SET search_path = public;
REVOKE ALL ON FUNCTION public.get_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;

-- 5. Cleanup routine hardening
ALTER FUNCTION public.cleanup_old_rate_limits() SET search_path = public;
REVOKE ALL ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC, authenticated, anon;

-- 6. Audit Grant on sensitive configurations
-- Ensure orchestrator_config is strictly protected
REVOKE ALL ON public.orchestrator_config FROM PUBLIC, authenticated, anon;
GRANT SELECT ON public.orchestrator_config TO service_role;
-- (RLS handles admin access)
