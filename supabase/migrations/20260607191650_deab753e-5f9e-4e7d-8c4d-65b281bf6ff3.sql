-- 1. Revogar execução global para funções no schema public
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public, anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public, anon;

-- 2. Permitir execução de has_role para usuários autenticados
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO service_role;

-- 3. Restringir funções críticas apenas para service_role com assinaturas corretas
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) TO service_role;
