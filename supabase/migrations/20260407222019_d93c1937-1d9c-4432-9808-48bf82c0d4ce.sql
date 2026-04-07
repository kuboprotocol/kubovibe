
CREATE POLICY "Authenticated users can view all streaks for leaderboard"
  ON public.user_streaks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all profiles for leaderboard"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);
