CREATE TABLE public.session_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cloud_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  project_id UUID,
  kind TEXT NOT NULL DEFAULT 'build',
  status TEXT NOT NULL DEFAULT 'queued',
  command TEXT,
  logs TEXT NOT NULL DEFAULT '',
  preview_url TEXT,
  credits_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_builds_session ON public.session_builds(session_id, created_at DESC);
CREATE INDEX idx_session_builds_user ON public.session_builds(user_id, created_at DESC);

GRANT SELECT ON public.session_builds TO authenticated;
GRANT ALL ON public.session_builds TO service_role;

ALTER TABLE public.session_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own builds"
  ON public.session_builds FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all builds"
  ON public.session_builds FOR SELECT
  TO authenticated
  USING (public.has_role('admin'));

CREATE POLICY "Admins can view all cloud sessions"
  ON public.cloud_sessions FOR SELECT
  TO authenticated
  USING (public.has_role('admin'));

CREATE TRIGGER update_session_builds_updated_at
  BEFORE UPDATE ON public.session_builds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_builds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cloud_sessions;
ALTER TABLE public.session_builds REPLICA IDENTITY FULL;
ALTER TABLE public.cloud_sessions REPLICA IDENTITY FULL;