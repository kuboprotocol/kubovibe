-- 1) Remove leitura anônima da coluna sensível `messages` em projects
REVOKE SELECT (messages) ON public.projects FROM anon;

-- 2) Política SELECT explícita para github_connections (token storage)
DROP POLICY IF EXISTS "Users can view own github connection" ON public.github_connections;
CREATE POLICY "Users can view own github connection"
ON public.github_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);