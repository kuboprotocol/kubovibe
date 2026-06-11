
-- Keep the broad SELECT policy on profiles (needed for leaderboard joins),
-- but enforce column-level security so referral_code is not readable by other users.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, display_name, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
-- referral_code is intentionally NOT granted to authenticated; owners read it via
-- the SECURITY DEFINER RPC public.get_my_referral_code().

-- Drop the {public}-role catch-all policy on skill_executions
DROP POLICY IF EXISTS "Service role can manage all skill executions" ON public.skill_executions;
