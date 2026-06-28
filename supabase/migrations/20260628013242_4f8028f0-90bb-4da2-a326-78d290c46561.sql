
CREATE TABLE public.deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'webhook',
  provider TEXT,
  external_id TEXT,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'queued',
  commit_sha TEXT,
  commit_message TEXT,
  branch TEXT,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  estimated_duration_ms INTEGER,
  url TEXT,
  log TEXT NOT NULL DEFAULT '',
  healthy BOOLEAN,
  is_current BOOLEAN NOT NULL DEFAULT false,
  rolled_back_to UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX deployments_started_at_idx ON public.deployments (started_at DESC);
CREATE INDEX deployments_status_idx ON public.deployments (status);
CREATE UNIQUE INDEX deployments_one_current_idx ON public.deployments (environment) WHERE is_current = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployments TO authenticated;
GRANT ALL ON public.deployments TO service_role;

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read deployments"
  ON public.deployments FOR SELECT TO authenticated
  USING (public.has_role('admin'));

CREATE POLICY "Admins can insert deployments"
  ON public.deployments FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "Admins can update deployments"
  ON public.deployments FOR UPDATE TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

CREATE TRIGGER trg_deployments_updated_at
  BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;
ALTER TABLE public.deployments REPLICA IDENTITY FULL;
