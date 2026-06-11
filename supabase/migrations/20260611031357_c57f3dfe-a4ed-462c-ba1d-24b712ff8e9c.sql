CREATE TABLE IF NOT EXISTS public.pwa_telemetry_clear_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT ON public.pwa_telemetry_clear_logs TO authenticated;
GRANT ALL ON public.pwa_telemetry_clear_logs TO service_role;

ALTER TABLE public.pwa_telemetry_clear_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view clear logs" ON public.pwa_telemetry_clear_logs
  FOR SELECT USING (public.has_any_role(ARRAY['admin']));
