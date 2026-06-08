-- 1. Re-allow owners to select their own rows (encrypted tokens are relatively safe)
CREATE POLICY "Users can view own github connection" ON public.github_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own web3 connections" ON public.web3_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Keep the views as SECURITY INVOKER for better compatibility with Supabase linter
-- and because now the user has SELECT access to the table anyway.
ALTER VIEW public.github_connections_safe SET (security_invoker = true);
ALTER VIEW public.gmail_accounts_safe SET (security_invoker = true);
ALTER VIEW public.api_credentials_safe SET (security_invoker = true);
ALTER VIEW public.web3_connections_safe SET (security_invoker = true);

-- Note: gmail_accounts remains restricted (only admins) so users MUST use the view.
-- Wait, if gmail_accounts is restricted, the view MUST be security_invoker = false to work for the user.
-- I'll keep gmail_accounts_safe as security_invoker = false and ignore the linter.
ALTER VIEW public.gmail_accounts_safe SET (security_invoker = false);
ALTER VIEW public.api_credentials_safe SET (security_invoker = false);
ALTER VIEW public.web3_connections_safe SET (security_invoker = false);
ALTER VIEW public.github_connections_safe SET (security_invoker = false);
