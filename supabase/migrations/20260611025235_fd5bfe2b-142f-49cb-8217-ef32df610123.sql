
CREATE TABLE IF NOT EXISTS public.pwa_telemetry_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  canvas_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('image','svg','font','other')),
  url TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwa_telem_user ON public.pwa_telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pwa_telem_session ON public.pwa_telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_pwa_telem_canvas ON public.pwa_telemetry_events(canvas_id);
CREATE INDEX IF NOT EXISTS idx_pwa_telem_type ON public.pwa_telemetry_events(type);
CREATE INDEX IF NOT EXISTS idx_pwa_telem_created_at ON public.pwa_telemetry_events(created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.pwa_telemetry_events TO authenticated;
GRANT ALL ON public.pwa_telemetry_events TO service_role;

ALTER TABLE public.pwa_telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_any_role(_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = ANY(_roles)
  )
$$;

CREATE POLICY "Users can insert own telemetry"
ON public.pwa_telemetry_events
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Telemetry readers can view"
ON public.pwa_telemetry_events
FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','analyst','viewer']));

CREATE POLICY "Telemetry admins can delete"
ON public.pwa_telemetry_events
FOR DELETE TO authenticated
USING (public.has_any_role(ARRAY['admin','analyst']));
