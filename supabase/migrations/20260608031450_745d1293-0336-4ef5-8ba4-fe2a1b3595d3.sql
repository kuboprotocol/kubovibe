-- Recreate views with security_invoker = true
DROP VIEW IF EXISTS public.api_credentials_safe;
CREATE VIEW public.api_credentials_safe WITH (security_invoker = true) AS
SELECT id, user_id, connector_slug, masked_hint, created_at, updated_at
FROM public.api_credentials
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();

GRANT SELECT ON public.api_credentials_safe TO authenticated;

DROP VIEW IF EXISTS public.gmail_accounts_safe;
CREATE VIEW public.gmail_accounts_safe WITH (security_invoker = true) AS
SELECT id, user_id, email, display_name, avatar_url, scope, access_token_cache, access_token_expires_at, last_synced_at, created_at, updated_at
FROM public.gmail_accounts
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();

GRANT SELECT ON public.gmail_accounts_safe TO authenticated;
