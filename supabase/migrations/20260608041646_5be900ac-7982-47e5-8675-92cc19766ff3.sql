-- 1. Restrict direct access to github_connections
DROP POLICY IF EXISTS "Users can view own github connection" ON public.github_connections;
-- Re-create the policy only for admins if needed, or just leave it for service_role (service role already has a policy)
CREATE POLICY "Admins can view all github connections" ON public.github_connections FOR SELECT TO authenticated USING (internal.is_kubo_admin());

-- 2. Update github_connections_safe view
-- We drop and recreate because we want to change reloptions (security_invoker)
DROP VIEW IF EXISTS public.github_connections_safe;
CREATE VIEW public.github_connections_safe WITH (security_invoker = false) AS
SELECT 
    id,
    user_id,
    github_username,
    github_avatar_url,
    scope,
    connected_at,
    updated_at
FROM public.github_connections
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();
GRANT SELECT ON public.github_connections_safe TO authenticated;

-- 3. Update gmail_accounts_safe view
DROP VIEW IF EXISTS public.gmail_accounts_safe;
CREATE VIEW public.gmail_accounts_safe WITH (security_invoker = false) AS
SELECT 
    id,
    user_id,
    email,
    display_name,
    avatar_url,
    scope,
    -- access_token_cache removed for security
    access_token_expires_at,
    last_synced_at,
    created_at,
    updated_at
FROM public.gmail_accounts
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();
GRANT SELECT ON public.gmail_accounts_safe TO authenticated;

-- 4. Ensure api_credentials_safe is also not security_invoker for consistency
DROP VIEW IF EXISTS public.api_credentials_safe;
CREATE VIEW public.api_credentials_safe WITH (security_invoker = false) AS
SELECT 
    id,
    user_id,
    connector_slug,
    masked_hint,
    created_at,
    updated_at
FROM public.api_credentials
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();
GRANT SELECT ON public.api_credentials_safe TO authenticated;
