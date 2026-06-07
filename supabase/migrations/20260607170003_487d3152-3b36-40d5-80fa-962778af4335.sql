REVOKE EXECUTE ON FUNCTION public.grant_credits(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_credits(UUID, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_credits(UUID, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, NUMERIC) TO service_role;
