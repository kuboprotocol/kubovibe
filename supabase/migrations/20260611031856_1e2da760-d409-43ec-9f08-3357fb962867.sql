-- Webhooks for anomaly notifications
CREATE TABLE IF NOT EXISTS public.pwa_telemetry_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT '{anomaly}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Performance metrics for telemetry operations
CREATE TABLE IF NOT EXISTS public.pwa_telemetry_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL, -- 'export', 'list', 'clear'
  duration_ms INTEGER NOT NULL,
  row_count INTEGER DEFAULT 0,
  filters JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Refactor clear logs to a general audit log if needed, or just add a 'type' to clear_logs
-- Let's stick to adding a new general audit table or extending the existing one.
-- Renaming or adding columns is better.
ALTER TABLE public.pwa_telemetry_clear_logs RENAME TO pwa_telemetry_audit_logs;
ALTER TABLE public.pwa_telemetry_audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'clear';

GRANT SELECT ON public.pwa_telemetry_webhooks TO authenticated;
GRANT ALL ON public.pwa_telemetry_webhooks TO service_role;
GRANT SELECT ON public.pwa_telemetry_metrics TO authenticated;
GRANT ALL ON public.pwa_telemetry_metrics TO service_role;
GRANT SELECT ON public.pwa_telemetry_audit_logs TO authenticated;
GRANT ALL ON public.pwa_telemetry_audit_logs TO service_role;

ALTER TABLE public.pwa_telemetry_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_telemetry_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_telemetry_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhooks" ON public.pwa_telemetry_webhooks
  FOR ALL USING (public.has_any_role(ARRAY['admin']));

CREATE POLICY "Admins can view metrics" ON public.pwa_telemetry_metrics
  FOR SELECT USING (public.has_any_role(ARRAY['admin']));

CREATE POLICY "Admins can view audit logs" ON public.pwa_telemetry_audit_logs
  FOR SELECT USING (public.has_any_role(ARRAY['admin']));
