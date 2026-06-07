
-- 1) github_connections: drop legacy plaintext access_token column (encrypted columns are the source of truth)
ALTER TABLE public.github_connections DROP COLUMN IF EXISTS access_token;

-- 2) api_credentials: revoke column-level SELECT on raw encryption material from authenticated;
-- only service_role (edge functions) needs to read ciphertext/iv/tag. Users keep access to metadata/masked_hint.
REVOKE SELECT (ciphertext, iv, tag) ON public.api_credentials FROM authenticated;

-- 3) orchestration_plans: allow owners to delete their own plans
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='orchestration_plans') THEN
    DROP POLICY IF EXISTS "Users can delete own orchestration plans" ON public.orchestration_plans;
    CREATE POLICY "Users can delete own orchestration plans"
      ON public.orchestration_plans
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
