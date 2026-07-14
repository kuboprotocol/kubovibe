REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;