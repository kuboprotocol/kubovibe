
-- 1. profiles: drop broad SELECT policy; expose only safe cols via view
DROP POLICY IF EXISTS "Authenticated users can view all profiles for leaderboard" ON public.profiles;

REVOKE SELECT (id, display_name, avatar_url, created_at, updated_at) ON public.profiles FROM authenticated;
REVOKE SELECT (id, display_name, avatar_url, created_at, updated_at) ON public.profiles FROM anon;

CREATE OR REPLACE VIEW public.leaderboard_profiles AS
SELECT id, display_name, avatar_url FROM public.profiles;

GRANT SELECT ON public.leaderboard_profiles TO authenticated, anon;

-- 2. user_streaks: drop broad policy; expose safe cols via view
DROP POLICY IF EXISTS "Authenticated users can view all streaks for leaderboard" ON public.user_streaks;

CREATE OR REPLACE VIEW public.leaderboard_streaks AS
SELECT user_id, current_streak, longest_streak, last_activity_date FROM public.user_streaks;

GRANT SELECT ON public.leaderboard_streaks TO authenticated;

-- 3. user_badges: replace broad policy; add owner-only and expose summary via view
DROP POLICY IF EXISTS "Users can view all badges" ON public.user_badges;

CREATE POLICY "Users can view own badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.leaderboard_badges AS
SELECT user_id, badge_type FROM public.user_badges;

GRANT SELECT ON public.leaderboard_badges TO authenticated;

-- 4. agent_jobs: explicit INSERT policy so user_id is enforced
DROP POLICY IF EXISTS "Users insert own jobs" ON public.agent_jobs;
CREATE POLICY "Users insert own jobs"
  ON public.agent_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. kubo_domain_transfers: re-assert revoke of auth_code (defense in depth)
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM authenticated;
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM anon;

-- 6. Revoke EXECUTE on internal trigger functions (not meant to be called by clients)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;

REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_creative_status_change() FROM anon;
