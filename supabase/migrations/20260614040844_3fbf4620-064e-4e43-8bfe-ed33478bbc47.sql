
-- 1. Drop overly broad SELECT policies on user_streaks and user_badges
DROP POLICY IF EXISTS "Authenticated can read streaks for leaderboard" ON public.user_streaks;
DROP POLICY IF EXISTS "Authenticated can read badges for leaderboard" ON public.user_badges;

-- 2. Hide referral_code column from authenticated users (still readable via SECURITY DEFINER RPC)
REVOKE SELECT (referral_code) ON public.profiles FROM authenticated;
REVOKE SELECT (referral_code) ON public.profiles FROM anon;

-- Make get_my_referral_code SECURITY DEFINER so it bypasses the column-level revoke
CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT referral_code FROM public.profiles WHERE id = auth.uid();
$$;

-- 3. Hide auth_code column on kubo_domain_transfers from clients (service_role still has access)
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM authenticated;
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM anon;
