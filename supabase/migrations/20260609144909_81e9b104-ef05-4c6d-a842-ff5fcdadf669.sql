
-- 1) Fix function search_path mutable
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 2) Restrict orchestrator_config to authenticated users (was public/anon)
DROP POLICY IF EXISTS "Everyone can view orchestrator_config" ON public.orchestrator_config;
CREATE POLICY "Authenticated can view orchestrator_config"
  ON public.orchestrator_config
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Hide referral_code from authenticated/anon (re-revoke after later grant overrode it)
REVOKE SELECT (referral_code) ON public.profiles FROM authenticated;
REVOKE SELECT (referral_code) ON public.profiles FROM anon;

-- Provide owner-only access via security definer RPC
CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT referral_code FROM public.profiles WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;

-- Allow referral lookup by code (for signup processing) via security definer
CREATE OR REPLACE FUNCTION public.find_referrer_by_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE referral_code = _code LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.find_referrer_by_code(text) TO authenticated;

-- 4) Realtime channel policies for agent_jobs and job_audit_logs
DROP POLICY IF EXISTS "Users can subscribe own agent_jobs topic" ON realtime.messages;
CREATE POLICY "Users can subscribe own agent_jobs topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE ('agent_jobs:user:' || (auth.uid())::text || '%')
    OR realtime.topic() NOT LIKE 'agent_jobs:%'
  );

DROP POLICY IF EXISTS "Users can subscribe own job_audit_logs topic" ON realtime.messages;
CREATE POLICY "Users can subscribe own job_audit_logs topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE ('job_audit_logs:user:' || (auth.uid())::text || '%')
    OR realtime.topic() NOT LIKE 'job_audit_logs:%'
  );
