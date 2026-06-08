-- Hardening SECURITY DEFINER views to SECURITY INVOKER with column-level grants

-- 1. api_credentials
ALTER VIEW public.api_credentials_safe SET (security_invoker = on);
REVOKE SELECT ON public.api_credentials FROM authenticated, anon;
GRANT SELECT (id, user_id, connector_slug, masked_hint, created_at, updated_at) ON public.api_credentials TO authenticated;
DROP POLICY IF EXISTS "Users view own credentials metadata" ON public.api_credentials;
CREATE POLICY "Users view own credentials metadata" ON public.api_credentials
FOR SELECT USING (auth.uid() = user_id OR internal.is_kubo_admin());

-- 2. github_connections
ALTER VIEW public.github_connections_safe SET (security_invoker = on);
REVOKE SELECT ON public.github_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, github_username, github_avatar_url, scope, connected_at, updated_at) ON public.github_connections TO authenticated;
DROP POLICY IF EXISTS "Users can view own github connection" ON public.github_connections;
CREATE POLICY "Users can view own github connection" ON public.github_connections
FOR SELECT USING (auth.uid() = user_id OR internal.is_kubo_admin());

-- 3. gmail_accounts
ALTER VIEW public.gmail_accounts_safe SET (security_invoker = on);
REVOKE SELECT ON public.gmail_accounts FROM authenticated, anon;
GRANT SELECT (id, user_id, email, display_name, avatar_url, scope, access_token_expires_at, last_synced_at, created_at, updated_at) ON public.gmail_accounts TO authenticated;
DROP POLICY IF EXISTS "gmail owner select" ON public.gmail_accounts;
CREATE POLICY "gmail owner select" ON public.gmail_accounts
FOR SELECT USING (auth.uid() = user_id OR internal.is_kubo_admin());

-- 4. web3_connections
ALTER VIEW public.web3_connections_safe SET (security_invoker = on);
REVOKE SELECT ON public.web3_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, provider, network, connection_name, api_key_hint, explorer_url, last_status, last_checked_at, last_block, last_latency_ms, last_error, created_at, updated_at) ON public.web3_connections TO authenticated;
DROP POLICY IF EXISTS "Users can view own web3 connections" ON public.web3_connections;
CREATE POLICY "Users can view own web3 connections" ON public.web3_connections
FOR SELECT USING (auth.uid() = user_id OR internal.is_kubo_admin());

-- Audit log
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('harden_views_to_security_invoker', 'database', 'views', true, '{"views": ["api_credentials_safe", "github_connections_safe", "gmail_accounts_safe", "web3_connections_safe"]}');