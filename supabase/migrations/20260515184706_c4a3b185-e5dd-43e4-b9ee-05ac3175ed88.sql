
CREATE TABLE public.api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  connector_slug TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  tag TEXT NOT NULL,
  masked_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, connector_slug)
);

ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- Users can SEE only metadata of their own credentials (ciphertext is never read on client; we expose metadata via RLS but front rule = never SELECT ciphertext)
CREATE POLICY "Users view own credentials metadata"
ON public.api_credentials FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credentials"
ON public.api_credentials FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users delete own credentials"
ON public.api_credentials FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER api_credentials_touch
BEFORE UPDATE ON public.api_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_api_credentials_user_slug ON public.api_credentials(user_id, connector_slug);
