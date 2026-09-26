-- KUBO AI Gateway: registro de execuções (Agent Activity) e cache de respostas.
--
-- ai_gateway_runs: uma linha por chamada ao gateway (tarefa, modelo, tokens,
-- custo estimado, duração, tentativas). O usuário lê as próprias execuções;
-- a escrita é feita pela edge function `ai-gateway` com service role.
--
-- ai_gateway_cache: respostas determinísticas reaproveitáveis. Só a service
-- role acessa (RLS ligada, sem policies).

CREATE TABLE IF NOT EXISTS public.ai_gateway_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_kind         text NOT NULL,
  tier              text,
  provider          text,
  model             text,
  cached            boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  error             text,
  prompt_tokens     integer,
  completion_tokens integer,
  cost_usd          numeric(12, 6) NOT NULL DEFAULT 0,
  duration_ms       integer,
  attempts          text[] NOT NULL DEFAULT '{}',
  dropped_messages  integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_gateway_runs_user_created_idx
  ON public.ai_gateway_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_gateway_runs_project_idx
  ON public.ai_gateway_runs (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.ai_gateway_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_gateway_runs_select_own" ON public.ai_gateway_runs;
CREATE POLICY "ai_gateway_runs_select_own"
  ON public.ai_gateway_runs FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.ai_gateway_runs FROM anon;
GRANT SELECT ON public.ai_gateway_runs TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_gateway_cache (
  key        text PRIMARY KEY,
  content    text NOT NULL,
  task_kind  text NOT NULL,
  model      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_gateway_cache_expires_idx
  ON public.ai_gateway_cache (expires_at);

ALTER TABLE public.ai_gateway_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_gateway_cache FROM anon, authenticated;

-- Painel Agent Activity recebe novas execuções em tempo real (RLS aplica).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_gateway_runs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_gateway_runs;
  END IF;
END $$;
