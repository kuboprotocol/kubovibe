
-- Add DELETE policy for connected_accounts (owners only)
CREATE POLICY "Users can delete own connected accounts"
ON public.connected_accounts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Defensive column-level revoke on sensitive auth_code in kubo_domain_transfers
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM anon, authenticated, PUBLIC;
