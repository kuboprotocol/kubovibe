CREATE TABLE public.cloud_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  container_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'starting',
  preview_url TEXT,
  terminal_url TEXT,
  idle_timeout_seconds INTEGER NOT NULL DEFAULT 900,
  billed_minutes INTEGER NOT NULL DEFAULT 0,
  credits_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cloud_sessions_user ON public.cloud_sessions(user_id, started_at DESC);

GRANT SELECT ON public.cloud_sessions TO authenticated;
GRANT ALL ON public.cloud_sessions TO service_role;

ALTER TABLE public.cloud_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cloud sessions"
  ON public.cloud_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


CREATE TABLE public.mobile_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apns_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'ios',
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mobile_devices_user ON public.mobile_devices(user_id);

GRANT SELECT, DELETE ON public.mobile_devices TO authenticated;
GRANT ALL ON public.mobile_devices TO service_role;

ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
  ON public.mobile_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
  ON public.mobile_devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cloud_sessions_updated_at
  BEFORE UPDATE ON public.cloud_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mobile_devices_updated_at
  BEFORE UPDATE ON public.mobile_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();