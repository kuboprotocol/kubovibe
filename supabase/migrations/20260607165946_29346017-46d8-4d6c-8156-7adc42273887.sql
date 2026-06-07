REVOKE ALL ON FUNCTION public.grant_credits(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, NUMERIC) TO service_role;
