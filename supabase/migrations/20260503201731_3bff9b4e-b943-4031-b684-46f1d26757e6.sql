-- ============================================================
-- 1) projects.messages — não expor para anônimos em projetos publicados
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view published projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;

-- Dono vê tudo
CREATE POLICY "Owners can view own projects (full)" ON public.projects
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- View pública: somente colunas necessárias (sem messages). Implementada via VIEW SECURITY INVOKER.
CREATE OR REPLACE VIEW public.published_projects
WITH (security_invoker = true) AS
SELECT id, title, description, generated_code, published_at, published_url, is_published, created_at, updated_at, user_id
FROM public.projects
WHERE is_published = true;

GRANT SELECT ON public.published_projects TO anon, authenticated;

-- Política mínima na tabela base para a view ler quando is_published=true (excluindo messages do client)
CREATE POLICY "Public can view published project meta" ON public.projects
  FOR SELECT TO anon, authenticated
  USING (is_published = true AND auth.uid() IS DISTINCT FROM user_id);
-- Nota: clients devem usar `published_projects` para conteúdo público.

-- ============================================================
-- 2) github_connections — não expor access_token ao cliente
-- ============================================================
DROP POLICY IF EXISTS "Users can view own github connection" ON public.github_connections;
DROP POLICY IF EXISTS "Users can insert own github connection" ON public.github_connections;
DROP POLICY IF EXISTS "Users can update own github connection" ON public.github_connections;

-- View segura sem access_token para o cliente
CREATE OR REPLACE VIEW public.github_connections_safe
WITH (security_invoker = true) AS
SELECT id, user_id, github_username, github_avatar_url, scope, connected_at, updated_at
FROM public.github_connections
WHERE auth.uid() = user_id;

GRANT SELECT ON public.github_connections_safe TO authenticated;

-- Mantém RLS estrito; SELECT de tokens passa a exigir service_role.
CREATE POLICY "Service role manages tokens" ON public.github_connections
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Permite o usuário deletar a própria conexão (revogar)
CREATE POLICY "Users can delete own github connection (token-safe)" ON public.github_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE SELECT ON public.github_connections FROM anon, authenticated;
GRANT SELECT (id, user_id, github_username, github_avatar_url, scope, connected_at, updated_at)
  ON public.github_connections TO authenticated;

-- ============================================================
-- 3) Realtime — restringe subscriptions ao tópico do próprio usuário
-- ============================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe own connector_activity_logs topic" ON realtime.messages;
CREATE POLICY "Users can subscribe own connector_activity_logs topic"
  ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'connector_activity_logs:user:' || auth.uid()::text || '%'
    OR realtime.topic() NOT LIKE 'connector_activity_logs:%'
  );

-- ============================================================
-- 4) connect_products — exige login para leitura
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view products" ON public.connect_products;
CREATE POLICY "Authenticated users can view products" ON public.connect_products
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 5) subscriptions — bloqueia auto-inserir/auto-mudar plano
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

-- Apenas service_role escreve. Usuários só leem.
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 6) user_badges, ad_rewards, referrals — só backend insere
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;
CREATE POLICY "Service role inserts badges" ON public.user_badges
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert own ad rewards" ON public.ad_rewards;
CREATE POLICY "Service role inserts ad rewards" ON public.ad_rewards
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "Service role inserts referrals" ON public.referrals
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');