
-- 1. Restrict referral_code column on profiles to server-side only (RPC get_my_referral_code)
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- 2. Rewrite has_role() as SECURITY DEFINER with pinned search_path (match has_any_role)
CREATE OR REPLACE FUNCTION public.has_role(_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;
