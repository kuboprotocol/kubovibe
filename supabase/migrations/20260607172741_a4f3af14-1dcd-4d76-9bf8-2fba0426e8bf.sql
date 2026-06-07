-- 1. Restringir log_connector_activity
REVOKE ALL ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) TO service_role;

-- 2. Reforçar restrições em outras funções SECURITY DEFINER (Double check)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;

REVOKE ALL ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
