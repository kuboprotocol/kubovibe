ALTER FUNCTION public.notify_creative_status_change() SET search_path = public, net;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_creative_status_change() TO service_role;
