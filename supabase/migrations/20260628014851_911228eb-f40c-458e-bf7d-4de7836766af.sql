
CREATE TABLE IF NOT EXISTS public.runtime_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  release TEXT,
  ip TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runtime_errors_created_at_idx ON public.runtime_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS runtime_errors_ip_created_idx ON public.runtime_errors (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS runtime_errors_severity_idx ON public.runtime_errors (severity, created_at DESC);

GRANT ALL ON public.runtime_errors TO service_role;
-- intentionally NO grant to anon/authenticated; admins read via has_role('admin')

ALTER TABLE public.runtime_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read runtime errors" ON public.runtime_errors;
CREATE POLICY "Admins can read runtime errors"
  ON public.runtime_errors FOR SELECT TO authenticated
  USING (public.has_role('admin'));
