-- Revoke default execute on all functions in public schema (best practice)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Re-grant to specific roles
-- is_kubo_admin needs to be accessible by authenticated users
GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO service_role;

-- is_skill_admin needs to be accessible by authenticated users
GRANT EXECUTE ON FUNCTION public.is_skill_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_skill_admin() TO service_role;

-- handle_new_user is only for system (trigger)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Admin functions - ONLY for service_role
REVOKE EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) TO service_role;

-- Credit function - DANGEROUS!
REVOKE EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) TO service_role;

-- Email functions (pgmq)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- Rate limit
REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO service_role;

-- Fix the view (Security Definer -> Security Invoker implicitly or explicit OWNER check)
DROP VIEW IF EXISTS public.github_connections_safe;
CREATE OR REPLACE VIEW public.github_connections_safe AS
SELECT id, user_id, github_username, github_avatar_url, scope, connected_at, updated_at
FROM public.github_connections
WHERE auth.uid() = user_id;
ALTER VIEW public.github_connections_safe OWNER TO postgres;

-- Add RLS for OAuth states
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'github_oauth_states' AND policyname = 'Users can manage their own github oauth states') THEN
    CREATE POLICY "Users can manage their own github oauth states" ON public.github_oauth_states
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gmail_oauth_states' AND policyname = 'Users can manage their own gmail oauth states') THEN
    CREATE POLICY "Users can manage their own gmail oauth states" ON public.gmail_oauth_states
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;