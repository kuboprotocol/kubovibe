-- 1. Centralized Admin Check (if not already there, hardening it)
CREATE OR REPLACE FUNCTION internal.is_kubo_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.role() = 'service_role') OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Safe View for api_credentials
CREATE OR REPLACE VIEW public.api_credentials_safe AS
SELECT id, user_id, connector_slug, masked_hint, created_at, updated_at
FROM public.api_credentials
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();

GRANT SELECT ON public.api_credentials_safe TO authenticated;

-- 3. Safe View for gmail_accounts
CREATE OR REPLACE VIEW public.gmail_accounts_safe AS
SELECT id, user_id, email, display_name, avatar_url, scope, access_token_cache, access_token_expires_at, last_synced_at, created_at, updated_at
FROM public.gmail_accounts
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();

GRANT SELECT ON public.gmail_accounts_safe TO authenticated;

-- 4. Restrict direct SELECT on the base tables to prevent metadata leakage
-- We modify existing policies to only allow service_role or admins to see all columns.
-- Authenticated users should use the views.

ALTER POLICY "Users view own credentials metadata" ON public.api_credentials
USING (internal.is_kubo_admin()); -- Now only admins/service_role see raw table

ALTER POLICY "gmail owner select" ON public.gmail_accounts
USING (internal.is_kubo_admin()); -- Now only admins/service_role see raw table

-- 5. Add Audit Log for these changes
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('rls_hardening_views', 'database', 'public', true, '{"views": ["api_credentials_safe", "gmail_accounts_safe"], "status": "restricted_direct_access"}');
