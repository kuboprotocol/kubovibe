
-- Enforce strict column-level security on sensitive tables

-- api_credentials: Hide ciphertext, iv, tag
REVOKE SELECT ON public.api_credentials FROM authenticated, anon;
GRANT SELECT (id, user_id, connector_slug, masked_hint, created_at, updated_at) ON public.api_credentials TO authenticated;
GRANT ALL ON public.api_credentials TO service_role;

-- audit_shares: Hide password_hash
REVOKE SELECT ON public.audit_shares FROM authenticated, anon;
GRANT SELECT (id, user_id, storage_path, label, size_bytes, expires_at, revoked_at, download_count, last_accessed_at, created_at, updated_at) ON public.audit_shares TO authenticated;
GRANT ALL ON public.audit_shares TO service_role;

-- web3_connections: Hide secrets
REVOKE SELECT ON public.web3_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, provider, network, connection_name, api_key_hint, explorer_url, last_status, last_checked_at, last_block, last_latency_ms, last_error, created_at, updated_at) ON public.web3_connections TO authenticated;
GRANT ALL ON public.web3_connections TO service_role;

-- render_connections: Hide secrets
REVOKE SELECT ON public.render_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, name, api_key_hint, workspace_id, last_status, last_checked_at, last_latency_ms, last_error, created_at, updated_at) ON public.render_connections TO authenticated;
GRANT ALL ON public.render_connections TO service_role;

-- gmail_accounts: Hide tokens
REVOKE SELECT ON public.gmail_accounts FROM authenticated, anon;
GRANT SELECT (id, user_id, email, display_name, avatar_url, scope, access_token_expires_at, last_synced_at, created_at, updated_at) ON public.gmail_accounts TO authenticated;
GRANT ALL ON public.gmail_accounts TO service_role;

-- github_connections: Hide access_token
REVOKE SELECT ON public.github_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, github_username, github_avatar_url, scope, connected_at, updated_at) ON public.github_connections TO authenticated;
GRANT ALL ON public.github_connections TO service_role;

-- email_unsubscribe_tokens: Hide token (can be used for unauthorized unsubscription if leaked)
-- Note: The token itself is usually used in the URL and handled by an edge function which uses service_role.
REVOKE SELECT ON public.email_unsubscribe_tokens FROM authenticated, anon;
GRANT SELECT (id, email, created_at, used_at) ON public.email_unsubscribe_tokens TO authenticated;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
