ALTER TABLE public.connector_activity_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connector_activity_logs;