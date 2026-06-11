-- 1. Hardening orchestrator_config
-- Remove broad authenticated SELECT policy
DROP POLICY IF EXISTS "Authenticated can view orchestrator_config" ON public.orchestrator_config;

-- Ensure RLS is active
ALTER TABLE public.orchestrator_config ENABLE ROW LEVEL SECURITY;

-- 2. Hygiene for rate_limit_counters
-- Add TTL cleanup function and trigger if not exists
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits() 
RETURNS trigger AS $$
BEGIN
    DELETE FROM public.rate_limit_counters WHERE created_at < now() - interval '24 hours';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cleanup_rate_limits ON public.rate_limit_counters;
CREATE TRIGGER trigger_cleanup_rate_limits
    AFTER INSERT ON public.rate_limit_counters
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.cleanup_old_rate_limits();

-- 3. Hardening SECURITY DEFINER functions
-- Explicitly revoke execute from PUBLIC on critical internal functions
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(text[]) FROM PUBLIC, authenticated, anon;

-- Re-grant to authenticated/service_role as they are needed for RLS evaluation
-- RLS policies run as the user, so they need execute permission on functions used in policies
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated, service_role;
