
REVOKE EXECUTE ON FUNCTION public.has_any_role(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO service_role;
