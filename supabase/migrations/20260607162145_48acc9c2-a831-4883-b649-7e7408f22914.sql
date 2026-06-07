-- Revoke SELECT on sensitive columns to enforce column-level security.
-- Authenticated and anon roles should not be able to read raw secrets, tokens, or hashes.

-- api_credentials
REVOKE SELECT (ciphertext, iv, tag) ON public.api_credentials FROM authenticated, anon;

-- audit_shares
REVOKE SELECT (password_hash) ON public.audit_shares FROM authenticated, anon;

-- web3_connections
REVOKE SELECT (rpc_url_ciphertext, rpc_url_iv, rpc_url_tag, api_key_ciphertext, api_key_iv, api_key_tag) ON public.web3_connections FROM authenticated, anon;

-- render_connections
REVOKE SELECT (api_key_ciphertext, api_key_iv, api_key_tag) ON public.render_connections FROM authenticated, anon;

-- gmail_accounts
REVOKE SELECT (refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, access_token_cache) ON public.gmail_accounts FROM authenticated, anon;

-- github_connections
REVOKE SELECT (access_token) ON public.github_connections FROM authenticated, anon;

-- email_unsubscribe_tokens
REVOKE SELECT (token) ON public.email_unsubscribe_tokens FROM authenticated, anon;
