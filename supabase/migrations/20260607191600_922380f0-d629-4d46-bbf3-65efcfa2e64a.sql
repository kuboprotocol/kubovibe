-- 1. Reset Global de Permissões (Remover GRANT ALL acidental)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated;', r.tablename);
    END LOOP;
END $$;

-- 2. Garantir acesso total para service_role (Backend/Edge Functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. Restaurar acessos básicos para usuários autenticados (Tabelas de Usuário)
-- Tabelas que o usuário gerencia diretamente
GRANT SELECT, INSERT, UPDATE, DELETE ON 
    public.profiles, 
    public.projects, 
    public.project_versions,
    public.subscriptions,
    public.user_badges,
    public.user_streaks,
    public.npc_memories,
    public.slide_decks,
    public.slide_pages,
    public.creative_assets,
    public.referrals,
    public.connected_accounts,
    public.support_tickets,
    public.shortlinks,
    public.shortlink_clicks,
    public.ad_rewards,
    public.orchestration_plans,
    public.contract_deployments,
    public.generated_contracts
TO authenticated;

-- 4. Segurança em Nível de Coluna (CLS) para Tabelas Sensíveis
-- api_credentials: Esconder ciphertext, iv, tag
GRANT SELECT (id, user_id, connector_slug, masked_hint, created_at, updated_at) ON public.api_credentials TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.api_credentials TO authenticated;

-- web3_connections: Esconder URLs de RPC e chaves de API
GRANT SELECT (id, user_id, provider, network, connection_name, api_key_hint, explorer_url, last_status, last_checked_at, last_block, last_latency_ms, last_error, created_at, updated_at) ON public.web3_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.web3_connections TO authenticated;

-- gmail_accounts: Esconder refresh tokens
GRANT SELECT (id, user_id, email, display_name, avatar_url, scope, access_token_expires_at, last_synced_at, created_at, updated_at) ON public.gmail_accounts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gmail_accounts TO authenticated;

-- github_connections: Esconder access tokens
GRANT SELECT (id, user_id, github_username, github_avatar_url, scope, connected_at, updated_at) ON public.github_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.github_connections TO authenticated;

-- render_connections: Esconder chaves de API
GRANT SELECT (id, user_id, name, api_key_hint, workspace_id, last_status, last_checked_at, last_latency_ms, last_error, created_at, updated_at) ON public.render_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.render_connections TO authenticated;

-- 5. Acessos para usuários Anônimos (Somente o necessário)
GRANT SELECT ON public.shortlinks TO anon;
GRANT INSERT ON public.shortlink_clicks TO anon;
