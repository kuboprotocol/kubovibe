
-- 1) Catálogo público de agentes
CREATE TABLE public.agent_registry (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  credit_cost INTEGER NOT NULL DEFAULT 1,
  edge_function TEXT NOT NULL,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','beta','planned','disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_registry TO anon, authenticated;
GRANT ALL ON public.agent_registry TO service_role;

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active agents"
  ON public.agent_registry FOR SELECT
  USING (status <> 'disabled');

CREATE TRIGGER touch_agent_registry_updated_at
  BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Histórico de execuções por usuário
CREATE TABLE public.agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_slug TEXT NOT NULL REFERENCES public.agent_registry(slug) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','refunded')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error_message TEXT,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.agent_jobs TO authenticated;
GRANT ALL ON public.agent_jobs TO service_role;

ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON public.agent_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all jobs"
  ON public.agent_jobs FOR SELECT TO authenticated
  USING (public.is_kubo_admin());

CREATE POLICY "Users can insert own jobs"
  ON public.agent_jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own jobs"
  ON public.agent_jobs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_agent_jobs_user ON public.agent_jobs(user_id, created_at DESC);
CREATE INDEX idx_agent_jobs_agent ON public.agent_jobs(agent_slug, created_at DESC);
CREATE INDEX idx_agent_jobs_status ON public.agent_jobs(status) WHERE status IN ('queued','running');

CREATE TRIGGER touch_agent_jobs_updated_at
  BEFORE UPDATE ON public.agent_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Seed do catálogo (KUBO Creative Studio)
INSERT INTO public.agent_registry (slug, name, description, category, credit_cost, edge_function, icon, status) VALUES
  ('pdf-creator',     'PDF Creator',        'Gera PDFs profissionais a partir de prompt/markdown.',           'documents', 5,  'agent-pdf-creator',  'FileText',   'active'),
  ('nano-banana',     'Nano Banana',        'Gerador rápido de conteúdo (legendas, posts, ideias).',          'content',   2,  'agent-nano-banana',  'Banana',     'active'),
  ('image-editor',    'Image Editor',       'Geração e edição de imagens com IA.',                            'media',     3,  'agent-image-editor', 'Image',      'active'),
  ('music-suno',      'Music AI (Suno)',    'Composição musical via Suno AI.',                                'media',     10, 'agent-music-suno',   'Music',      'active'),
  ('slides',          'Slides Generator',   'Cria apresentações estruturadas em slides.',                     'documents', 10, 'agent-slides',       'Presentation', 'beta'),
  ('docs-creator',    'Docs Creator',       'Documentos Word/Markdown longos.',                               'documents', 5,  'agent-docs-creator', 'FileEdit',   'beta'),
  ('doc-converter',   'Doc Converter',      'Converte entre PDF, DOCX, MD, HTML.',                            'documents', 3,  'agent-doc-converter','RefreshCw',  'beta'),
  ('video-downloader','Video Downloader',   'Baixa vídeos de múltiplas plataformas.',                         'media',     5,  'agent-video-downloader','Download','beta'),
  ('opusclip',        'OpusClip',           'Corte inteligente de vídeos longos em clipes virais.',           'media',     15, 'agent-opusclip',     'Scissors',   'beta'),
  ('avatar-speaker',  'Avatar Falante',     'Avatar com voz IA narrando script.',                             'media',     20, 'agent-avatar-speaker','UserCircle','beta'),
  ('short-video',     'Short Video Creator','Vídeos de 30s/60s prontos para reels/shorts.',                   'media',     15, 'agent-short-video',  'Film',       'beta'),
  ('chat-agent',      'Chat Inteligente',   'Chat conversacional multi-modelo.',                              'content',   1,  'agent-chat',         'MessageCircle', 'beta'),
  ('manus',           'Manus Tasks',        'Automação web e pesquisa profunda.',                             'automation',5,  'agent-manus',        'Bot',        'beta'),
  ('creative-panel',  'Creative Panel',     'Painel criativo interativo multi-tarefa.',                       'content',   2,  'agent-creative-panel','Palette',   'beta');
