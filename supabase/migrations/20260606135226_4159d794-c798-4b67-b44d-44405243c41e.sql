-- Revoke execute on is_skill_admin from anon
REVOKE EXECUTE ON FUNCTION public.is_skill_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_skill_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_skill_admin() TO service_role;

-- Ensure is_kubo_admin is also restricted
REVOKE EXECUTE ON FUNCTION public.is_kubo_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO service_role;