-- =====================
-- AUDIT SHARES
-- =====================
CREATE TABLE public.audit_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  label TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_shares_user ON public.audit_shares(user_id, created_at DESC);

ALTER TABLE public.audit_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own shares" ON public.audit_shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own shares" ON public.audit_shares
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own shares" ON public.audit_shares
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages shares" ON public.audit_shares
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- timestamp trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_audit_shares_updated
  BEFORE UPDATE ON public.audit_shares
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Make audit-reports bucket private (downloads go through edge function)
UPDATE storage.buckets SET public = false WHERE id = 'audit-reports';

-- Storage policies: owners can upload to their own folder, service role manages all
DROP POLICY IF EXISTS "Anyone can view audit reports" ON storage.objects;
DROP POLICY IF EXISTS "Public view audit reports" ON storage.objects;

CREATE POLICY "Users upload own audit reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audit-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own audit reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audit-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own audit reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audit-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================
-- SLIDES
-- =====================
CREATE TABLE public.slide_decks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled deck',
  theme JSONB NOT NULL DEFAULT '{"name":"midnight"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slide_decks_user ON public.slide_decks(user_id, updated_at DESC);

ALTER TABLE public.slide_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own decks" ON public.slide_decks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own decks" ON public.slide_decks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own decks" ON public.slide_decks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own decks" ON public.slide_decks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_slide_decks_updated
  BEFORE UPDATE ON public.slide_decks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.slide_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deck_id UUID NOT NULL REFERENCES public.slide_decks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  layout TEXT NOT NULL DEFAULT 'title-content',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slide_pages_deck ON public.slide_pages(deck_id, position);

ALTER TABLE public.slide_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own pages" ON public.slide_pages
  FOR SELECT TO authenticated
  USING (deck_id IN (SELECT id FROM public.slide_decks WHERE user_id = auth.uid()));
CREATE POLICY "Users insert own pages" ON public.slide_pages
  FOR INSERT TO authenticated
  WITH CHECK (deck_id IN (SELECT id FROM public.slide_decks WHERE user_id = auth.uid()));
CREATE POLICY "Users update own pages" ON public.slide_pages
  FOR UPDATE TO authenticated
  USING (deck_id IN (SELECT id FROM public.slide_decks WHERE user_id = auth.uid()));
CREATE POLICY "Users delete own pages" ON public.slide_pages
  FOR DELETE TO authenticated
  USING (deck_id IN (SELECT id FROM public.slide_decks WHERE user_id = auth.uid()));

CREATE TRIGGER trg_slide_pages_updated
  BEFORE UPDATE ON public.slide_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();