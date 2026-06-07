-- api_credentials
REVOKE SELECT ON public.api_credentials FROM authenticated, anon;
GRANT SELECT (id, user_id, connector_slug, masked_hint, created_at, updated_at) ON public.api_credentials TO authenticated;
GRANT ALL ON public.api_credentials TO service_role;

-- web3_connections
REVOKE SELECT ON public.web3_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, provider, network, connection_name, api_key_hint, explorer_url, last_status, last_checked_at, last_block, last_latency_ms, last_error, created_at, updated_at) ON public.web3_connections TO authenticated;
GRANT ALL ON public.web3_connections TO service_role;

-- gmail_accounts
REVOKE SELECT ON public.gmail_accounts FROM authenticated, anon;
GRANT SELECT (id, user_id, email, display_name, avatar_url, scope, access_token_expires_at, last_synced_at, created_at, updated_at) ON public.gmail_accounts TO authenticated;
GRANT ALL ON public.gmail_accounts TO service_role;

-- render_connections
REVOKE SELECT ON public.render_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, name, api_key_hint, workspace_id, last_status, last_checked_at, last_latency_ms, last_error, created_at, updated_at) ON public.render_connections TO authenticated;
GRANT ALL ON public.render_connections TO service_role;
