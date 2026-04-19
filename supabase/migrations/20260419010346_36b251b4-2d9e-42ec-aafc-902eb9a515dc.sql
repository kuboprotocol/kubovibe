CREATE TABLE public.connector_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connector_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_connector_logs_user_slug ON public.connector_activity_logs(user_id, connector_slug, created_at DESC);

ALTER TABLE public.connector_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connector logs"
ON public.connector_activity_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connector logs"
ON public.connector_activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connector logs"
ON public.connector_activity_logs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);