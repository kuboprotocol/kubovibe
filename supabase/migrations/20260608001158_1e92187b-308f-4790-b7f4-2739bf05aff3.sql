-- 1) Revoke public execute on more SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_job_action(uuid, text, uuid, text) FROM PUBLIC;

-- 2) Grant specifically to appropriate roles
GRANT EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- execute_job_action is used by the frontend (OrchestratorPage)
GRANT EXECUTE ON FUNCTION public.execute_job_action(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_job_action(uuid, text, uuid, text) TO service_role;

-- Ensure trigger can still run (it runs as the role that triggers it, or superuser)
-- Actually, trigger functions should be granted to the role that triggers them if they are SECURITY INVOKER, 
-- but for SECURITY DEFINER, the caller needs EXECUTE. auth.users is handled by Supabase, 
-- so handle_new_user usually needs to be executable by the service role or whatever role Supabase uses for auth triggers.
-- Granting to service_role is standard.
