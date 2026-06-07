-- Grant permissions to authenticated and service_role for tables missing them
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_streaks TO authenticated;
GRANT ALL ON public.user_streaks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web3_connections TO authenticated;
GRANT ALL ON public.web3_connections TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_memories TO authenticated;
GRANT ALL ON public.npc_memories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connected_accounts TO authenticated;
GRANT ALL ON public.connected_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slide_pages TO authenticated;
GRANT ALL ON public.slide_pages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_credits TO authenticated;
GRANT ALL ON public.pending_credits TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_imports TO authenticated;
GRANT ALL ON public.skill_imports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_counters TO authenticated;
GRANT ALL ON public.rate_limit_counters TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slide_decks TO authenticated;
GRANT ALL ON public.slide_decks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlink_clicks TO authenticated;
GRANT ALL ON public.shortlink_clicks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_accounts TO authenticated;
GRANT ALL ON public.gmail_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kubo_domains TO authenticated;
GRANT ALL ON public.kubo_domains TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connector_activity_logs TO authenticated;
GRANT ALL ON public.connector_activity_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_assets TO authenticated;
GRANT ALL ON public.creative_assets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_versions TO authenticated;
GRANT ALL ON public.project_versions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_send_state TO authenticated;
GRANT ALL ON public.email_send_state TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kubo_dns_records TO authenticated;
GRANT ALL ON public.kubo_dns_records TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kubo_domain_transfers TO authenticated;
GRANT ALL ON public.kubo_domain_transfers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kubo_ionos_contracts TO authenticated;
GRANT ALL ON public.kubo_ionos_contracts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_rewards TO authenticated;
GRANT ALL ON public.ad_rewards TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_oauth_states TO authenticated;
GRANT ALL ON public.github_oauth_states TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.render_connections TO authenticated;
GRANT ALL ON public.render_connections TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orchestration_plans TO authenticated;
GRANT ALL ON public.orchestration_plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_connections TO authenticated;
GRANT ALL ON public.github_connections TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.render_auto_heal_policies TO authenticated;
GRANT ALL ON public.render_auto_heal_policies TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.render_heal_events TO authenticated;
GRANT ALL ON public.render_heal_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppressed_emails TO authenticated;
GRANT ALL ON public.suppressed_emails TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connect_products TO authenticated;
GRANT ALL ON public.connect_products TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_deployments TO authenticated;
GRANT ALL ON public.contract_deployments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_unsubscribe_tokens TO authenticated;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_contracts TO authenticated;
GRANT ALL ON public.generated_contracts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_shares TO authenticated;
GRANT ALL ON public.audit_shares TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_oauth_states TO authenticated;
GRANT ALL ON public.gmail_oauth_states TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlinks TO authenticated;
GRANT ALL ON public.shortlinks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_audit_logs TO authenticated;
GRANT ALL ON public.security_audit_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_credentials TO authenticated;
GRANT ALL ON public.api_credentials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_registry TO authenticated;
GRANT ALL ON public.agent_registry TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kubo_domain_transfer_events TO authenticated;
GRANT ALL ON public.kubo_domain_transfer_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_jobs TO authenticated;
GRANT ALL ON public.agent_jobs TO service_role;

-- Allow anon to read some public tables if needed (based on policies)
GRANT SELECT ON public.shortlinks TO anon;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT ON public.profiles TO anon;

-- Fix SECURITY DEFINER functions to include search_path (already set in DB but updating migrations for consistency)
-- This migration will ensure they are explicitly set.
ALTER FUNCTION public.enqueue_email(TEXT, JSONB) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(TEXT, INT, INT) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(TEXT, BIGINT) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) SET search_path = public, pgmq;
