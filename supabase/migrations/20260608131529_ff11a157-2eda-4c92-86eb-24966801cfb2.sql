ALTER TABLE public.creative_assets ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
GRANT SELECT, UPDATE ON public.creative_assets TO authenticated;
GRANT ALL ON public.creative_assets TO service_role;
CREATE INDEX IF NOT EXISTS idx_creative_assets_idempotency_key ON public.creative_assets(idempotency_key);