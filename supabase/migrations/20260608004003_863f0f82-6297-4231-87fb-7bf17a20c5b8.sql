-- 1. Tighten service_role policies
DO $$ 
DECLARE 
    r RECORD;
    sql_cmd TEXT;
BEGIN
    FOR r IN (
        SELECT tablename, policyname, cmd
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND qual::text LIKE '%auth.role() = ''service_role''%'
        AND roles = '{public}'
    ) LOOP
        sql_cmd := format('ALTER POLICY %I ON public.%I TO service_role USING (true)', r.policyname, r.tablename);
        IF r.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
            sql_cmd := sql_cmd || ' WITH CHECK (true)';
        END IF;
        EXECUTE sql_cmd;
    END LOOP;
END $$;

-- 2. Update policies to explicitly use internal.is_kubo_admin()
ALTER POLICY "Users read own plans" ON public.orchestration_plans USING ((auth.uid() = user_id) OR internal.is_kubo_admin());
ALTER POLICY "Users update own plans" ON public.orchestration_plans USING ((auth.uid() = user_id) OR internal.is_kubo_admin());

ALTER POLICY "Users read own contracts" ON public.generated_contracts USING ((auth.uid() = user_id) OR internal.is_kubo_admin());
ALTER POLICY "Users read own deployments" ON public.contract_deployments USING ((auth.uid() = user_id) OR internal.is_kubo_admin());

ALTER POLICY "Admin reads pending credits" ON public.pending_credits USING (internal.is_kubo_admin());
ALTER POLICY "Admins can view all audit logs" ON public.security_audit_logs USING (internal.is_kubo_admin());
ALTER POLICY "Admins can view all jobs" ON public.agent_jobs USING (internal.is_kubo_admin());

-- 3. Now it should be safe to drop the public duplicates
DROP FUNCTION IF EXISTS public.is_kubo_admin();
DROP FUNCTION IF EXISTS public.is_skill_admin();

-- 4. Narrow public policies for orchestration_plans and generated_contracts to authenticated
ALTER POLICY "Users read own plans" ON public.orchestration_plans TO authenticated;
ALTER POLICY "Users insert own plans" ON public.orchestration_plans TO authenticated;
ALTER POLICY "Users update own plans" ON public.orchestration_plans TO authenticated;

ALTER POLICY "Users read own contracts" ON public.generated_contracts TO authenticated;
ALTER POLICY "Users insert own contracts" ON public.generated_contracts TO authenticated;
ALTER POLICY "Users delete own contracts" ON public.generated_contracts TO authenticated;

ALTER POLICY "Users read own deployments" ON public.contract_deployments TO authenticated;
ALTER POLICY "Users insert own deployments" ON public.contract_deployments TO authenticated;

-- 5. Final hardening of agent_jobs
DROP POLICY IF EXISTS "Service role manages all jobs" ON public.agent_jobs;
CREATE POLICY "Service role manages all jobs" ON public.agent_jobs TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own jobs" ON public.agent_jobs;
CREATE POLICY "Users view own jobs" ON public.agent_jobs TO authenticated USING (auth.uid() = user_id);

-- 6. Revoke execute on internal functions from PUBLIC
REVOKE EXECUTE ON FUNCTION internal.is_kubo_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.is_skill_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.is_kubo_admin() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION internal.is_skill_admin() TO service_role, authenticated;

-- Hardening execute_job_action
REVOKE EXECUTE ON FUNCTION public.execute_job_action(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_job_action(uuid, text, uuid, text) TO service_role, authenticated;
