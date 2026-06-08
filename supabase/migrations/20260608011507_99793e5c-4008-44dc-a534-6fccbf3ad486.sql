-- Revoke execution from PUBLIC (which includes anon) for sensitive functions
-- Use simpler syntax where possible or correct signatures
REVOKE EXECUTE ON FUNCTION public.is_kubo_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) FROM PUBLIC;

-- Fix signatures for complex functions
REVOKE EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM PUBLIC;

-- Explicitly grant to roles that actually need them
GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- These are only for system/admin use
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO service_role;
