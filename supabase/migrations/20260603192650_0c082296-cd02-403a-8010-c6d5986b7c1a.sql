
CREATE TABLE public.creative_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL CHECK (tool IN ('chat','nano_banana','downloader','clips','avatar','shorts','music','ebook')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('queued','processing','completed','failed')),
  prompt TEXT,
  output_url TEXT,
  output_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_assets TO authenticated;
GRANT ALL ON public.creative_assets TO service_role;

ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own creative assets" ON public.creative_assets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own creative assets" ON public.creative_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own creative assets" ON public.creative_assets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own creative assets" ON public.creative_assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages creative assets" ON public.creative_assets
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX creative_assets_user_tool_idx ON public.creative_assets(user_id, tool, created_at DESC);

CREATE TRIGGER creative_assets_touch BEFORE UPDATE ON public.creative_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
