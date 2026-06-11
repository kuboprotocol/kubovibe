
-- Convert views to security_invoker so they honor the querying user's RLS
ALTER VIEW public.leaderboard_profiles SET (security_invoker = true);
ALTER VIEW public.leaderboard_streaks  SET (security_invoker = true);
ALTER VIEW public.leaderboard_badges   SET (security_invoker = true);

-- profiles: restore column-level SELECT for safe cols + broad SELECT policy.
-- referral_code remains NOT granted, so it's never exposed via Data API or view.
GRANT SELECT (id, display_name, avatar_url) ON public.profiles TO authenticated;

CREATE POLICY "Authenticated can read public profile fields"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- user_streaks: broad SELECT policy (data is intentionally public for leaderboard)
CREATE POLICY "Authenticated can read streaks for leaderboard"
  ON public.user_streaks FOR SELECT TO authenticated
  USING (true);

-- user_badges: broad SELECT policy (data is intentionally public for leaderboard)
CREATE POLICY "Authenticated can read badges for leaderboard"
  ON public.user_badges FOR SELECT TO authenticated
  USING (true);
