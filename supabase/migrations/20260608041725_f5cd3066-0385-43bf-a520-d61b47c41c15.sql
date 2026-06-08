-- 1. Restrict direct access to web3_connections
DROP POLICY IF EXISTS "Users can view own web3 connections" ON public.web3_connections;
CREATE POLICY "Admins can view all web3 connections" ON public.web3_connections FOR SELECT TO authenticated USING (internal.is_kubo_admin());

-- 2. Create web3_connections_safe view
DROP VIEW IF EXISTS public.web3_connections_safe;
CREATE VIEW public.web3_connections_safe WITH (security_invoker = false) AS
SELECT 
    id,
    user_id,
    provider,
    network,
    connection_name,
    api_key_hint,
    explorer_url,
    last_status,
    last_checked_at,
    last_block,
    last_latency_ms,
    last_error,
    created_at,
    updated_at
FROM public.web3_connections
WHERE (auth.uid() = user_id) OR internal.is_kubo_admin();
GRANT SELECT ON public.web3_connections_safe TO authenticated;
