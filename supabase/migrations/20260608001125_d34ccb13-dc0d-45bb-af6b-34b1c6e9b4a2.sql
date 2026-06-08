-- 1) Revoke public execute on SECURITY DEFINER functions in public schema
-- These should only be callable by service_role (edge functions/admin logic)

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) FROM PUBLIC;

-- Grant execute to service_role specifically
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) TO service_role;


-- 2) github_connections: restrict SELECT on raw encryption material from authenticated users
-- This matches the pattern established for api_credentials
REVOKE SELECT (access_token_ciphertext, access_token_iv, access_token_tag) ON public.github_connections FROM authenticated;


-- 3) performance_metrics: tighten RLS policy to satisfy linter and ensure auth
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert metrics' AND tablename = 'performance_metrics') THEN
    DROP POLICY "Authenticated users can insert metrics" ON public.performance_metrics;
    CREATE POLICY "Authenticated users can insert metrics"
      ON public.performance_metrics
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
