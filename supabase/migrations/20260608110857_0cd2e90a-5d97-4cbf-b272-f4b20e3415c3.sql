-- Add missing grants for tables with RLS policies but no explicit SELECT grant for authenticated users
GRANT SELECT ON public.audit_shares TO authenticated;
GRANT SELECT ON public.agent_registry TO authenticated, anon;

-- Audit log
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('add_missing_grants', 'database', 'audit_shares,agent_registry', true, '{"roles": ["authenticated", "anon"]}');