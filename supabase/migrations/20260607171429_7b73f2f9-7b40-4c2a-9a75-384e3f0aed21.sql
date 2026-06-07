-- 1. Restringir acesso a colunas sensíveis (PUBLIC_DATA_EXPOSURE)
-- Gmail
REVOKE SELECT (refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, access_token_cache) ON public.gmail_accounts FROM authenticated, anon;
-- Render
REVOKE SELECT (api_key_ciphertext) ON public.render_connections FROM authenticated, anon;
-- Web3
REVOKE SELECT (api_key_ciphertext, rpc_url_ciphertext) ON public.web3_connections FROM authenticated, anon;
-- API Credentials
REVOKE SELECT (ciphertext, iv, tag) ON public.api_credentials FROM authenticated, anon;
-- GitHub
REVOKE SELECT (access_token) ON public.github_connections FROM authenticated, anon;

-- 2. Restringir inserção em logs de auditoria (ACCESS_CONTROL)
-- Agent Jobs: Apenas service_role deve inserir/atualizar via Edge Functions
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.agent_jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.agent_jobs;
CREATE POLICY "Service role manages all jobs" ON public.agent_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Connector Activity Logs: Apenas service_role deve registrar atividades reais
DROP POLICY IF EXISTS "Users can insert own connector logs" ON public.connector_activity_logs;
CREATE POLICY "Service role inserts connector logs" ON public.connector_activity_logs FOR INSERT TO service_role WITH CHECK (true);

-- 3. Reforçar restrição em funções críticas (Function Security)
-- Garante que grant_credits e outras funções sensíveis não sejam chamáveis por usuários
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.execute_atomic_credit_deduction(uuid, integer, text, text, jsonb, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_security_audit(text, text, text, text, text, inet, text, boolean, text, jsonb, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_clear_connector_run(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_connector_runs(text, integer) TO service_role;
