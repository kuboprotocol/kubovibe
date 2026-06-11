
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_events TO authenticated;
GRANT ALL ON public.pwa_telemetry_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_export_jobs TO authenticated;
GRANT ALL ON public.pwa_telemetry_export_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_settings TO authenticated;
GRANT ALL ON public.pwa_telemetry_settings TO service_role;

GRANT SELECT, INSERT ON public.pwa_telemetry_audit_logs TO authenticated;
GRANT ALL ON public.pwa_telemetry_audit_logs TO service_role;

GRANT SELECT ON public.pwa_telemetry_metrics TO authenticated;
GRANT ALL ON public.pwa_telemetry_metrics TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pwa_telemetry_webhooks TO authenticated;
GRANT ALL ON public.pwa_telemetry_webhooks TO service_role;
