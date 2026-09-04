CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  triggered_by UUID,
  kind TEXT NOT NULL DEFAULT 'manual',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered',
  apns_id TEXT,
  error_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;

ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push deliveries" ON public.push_deliveries;
CREATE POLICY "Users read own push deliveries" ON public.push_deliveries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role('admin'));

CREATE INDEX IF NOT EXISTS idx_push_deliveries_created ON public.push_deliveries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_user ON public.push_deliveries (user_id, created_at DESC);