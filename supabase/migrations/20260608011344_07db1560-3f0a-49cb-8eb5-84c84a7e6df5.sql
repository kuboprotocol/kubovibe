-- 1. Redefine admin check to use role table
CREATE OR REPLACE FUNCTION public.is_kubo_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO service_role;

CREATE OR REPLACE FUNCTION internal.is_kubo_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_kubo_admin();
$$;

-- 2. Harden grant_credits function
CREATE OR REPLACE FUNCTION public.grant_credits(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_kubo_admin() THEN
    RAISE EXCEPTION 'forbidden: admin access required';
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, edits_used, edits_limit, is_active)
  VALUES (p_user_id, 'free', 0, 5 + p_amount, true)
  ON CONFLICT (user_id) DO UPDATE
  SET edits_limit = subscriptions.edits_limit + p_amount,
      updated_at = now();
END;
$$;

-- 3. Restrict agent_jobs policies for authenticated users
-- Remove overly permissive ALL policy
DROP POLICY IF EXISTS "Users view own jobs" ON public.agent_jobs;
DROP POLICY IF EXISTS "Users can view own jobs" ON public.agent_jobs;
DROP POLICY IF EXISTS "Users can delete own jobs" ON public.agent_jobs;

-- Re-add specific restricted policies
CREATE POLICY "Users can view own jobs" 
ON public.agent_jobs 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" 
ON public.agent_jobs 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Ensure is_kubo_admin triggers or other functions use the new check
-- No triggers found that need update based on search_path.

-- 5. Audit logs for security changes
INSERT INTO public.security_audit_logs (action, resource_type, resource_id, success, metadata)
VALUES ('security_hardening', 'system', 'rls_policies', true, '{"changes": ["is_kubo_admin refactor", "agent_jobs RLS restriction", "grant_credits hardening"]}');
