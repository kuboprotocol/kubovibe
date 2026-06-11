-- 1. Fix search path and revoke execute for cleanup_old_rate_limits
ALTER FUNCTION public.cleanup_old_rate_limits() SET search_path = public;
REVOKE ALL ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC, authenticated, anon;

-- 2. Revoke execute on get_my_referral_code (it should be called only by authenticated users, but we should be explicit)
REVOKE ALL ON FUNCTION public.get_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;

-- 3. Ensure internal triggers are strictly internal
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.notify_creative_status_change() FROM PUBLIC, authenticated, anon;

-- 4. Audit rate_limit_counters policies
-- If no policies exist, only service_role can access (which is what we want)
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limit_counters;
CREATE POLICY "Service role manages rate limits" ON public.rate_limit_counters FOR ALL TO service_role USING (true) WITH CHECK (true);
