-- Remove access_token_cache from gmail_accounts_safe view
CREATE OR REPLACE VIEW public.gmail_accounts_safe WITH (security_invoker = on) AS
SELECT id, user_id, email, display_name, avatar_url, scope, access_token_expires_at, last_synced_at, created_at, updated_at
FROM public.gmail_accounts
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();

-- Update grants to match the new view structure
REVOKE SELECT ON public.gmail_accounts FROM authenticated;
GRANT SELECT (id, user_id, email, display_name, avatar_url, scope, access_token_expires_at, last_synced_at, created_at, updated_at) ON public.gmail_accounts TO authenticated;

-- Audit log
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('harden_gmail_safe_view', 'database', 'gmail_accounts_safe', true, '{"removed": "access_token_cache"}');