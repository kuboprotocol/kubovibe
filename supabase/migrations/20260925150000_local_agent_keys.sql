-- Tokens de longa duração do KUBO Local Agent.
--
-- O daemon cobrava créditos com o access token de sessão do Supabase, que
-- expira em ~1h — depois disso toda ação de IA falhava com "unauthorized".
-- Estes tokens (formato `kubo_la_<48 hex>`) não expiram, só são revogados.
-- Guardamos apenas o SHA-256; o texto puro é mostrado uma única vez, na
-- criação, pela edge function `local-agent-keys`.

CREATE TABLE IF NOT EXISTS public.local_agent_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL DEFAULT 'Local Agent',
  key_prefix   text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS local_agent_keys_user_id_idx ON public.local_agent_keys (user_id);

ALTER TABLE public.local_agent_keys ENABLE ROW LEVEL SECURITY;

-- Leitura só das próprias chaves. Criação e revogação passam pela edge
-- function (service role), então não há policy de INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "local_agent_keys_select_own" ON public.local_agent_keys;
CREATE POLICY "local_agent_keys_select_own"
  ON public.local_agent_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.local_agent_keys FROM anon;
GRANT SELECT ON public.local_agent_keys TO authenticated;
