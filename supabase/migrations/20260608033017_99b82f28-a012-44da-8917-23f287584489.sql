-- 1. Hardening SECURITY DEFINER functions
-- We update all internal and public SECURITY DEFINER functions to have a fixed search_path.

-- internal.is_kubo_admin()
ALTER FUNCTION internal.is_kubo_admin() SET search_path = public, internal, auth;

-- internal.is_admin(p_user_id uuid)
ALTER FUNCTION internal.is_admin(uuid) SET search_path = public, internal, auth;

-- internal.is_skill_admin()
ALTER FUNCTION internal.is_skill_admin() SET search_path = public, internal, auth;

-- internal.grant_credits(p_user_id uuid, p_amount numeric)
ALTER FUNCTION internal.grant_credits(uuid, numeric) SET search_path = public, internal, auth;

-- internal.execute_atomic_credit_deduction(_user_id uuid, _amount integer, _reason text, _category text, _metadata jsonb, _idempotency_key text)
ALTER FUNCTION internal.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) SET search_path = public, internal, auth;

-- internal.bump_rate_limit(_bucket text, _user uuid, _window_seconds integer)
ALTER FUNCTION internal.bump_rate_limit(text, uuid, integer) SET search_path = public, internal, auth;

-- internal.log_security_audit(_action text, _resource_type text, _resource_id text, _job_id text, _request_id text, _ip inet, _user_agent text, _success boolean, _error_message text, _metadata jsonb, _actor_user_id uuid, _actor_role text)
ALTER FUNCTION internal.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) SET search_path = public, internal, auth;

-- internal.admin_list_connector_runs(_connector_slug text, _limit integer)
ALTER FUNCTION internal.admin_list_connector_runs(text, integer) SET search_path = public, internal, auth;

-- internal.admin_clear_connector_run(_connector_slug text, _run_id text)
ALTER FUNCTION internal.admin_clear_connector_run(text, text) SET search_path = public, internal, auth;

-- public.handle_new_user()
ALTER FUNCTION public.handle_new_user() SET search_path = public, internal, auth;

-- 2. Audit the fix
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('security_definer_hardening', 'function', 'all', true, '{"hardened_functions_count": 10, "fix": "search_path_enforcement_v2"}');