CREATE TABLE IF NOT EXISTS public.crash_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resource text,
  route text,
  message text NOT NULL,
  stack text,
  component_stack text,
  user_agent text,
  viewport text,
  retry_count int DEFAULT 0,
  health jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crash_reports_created_at ON public.crash_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crash_reports_user_id ON public.crash_reports (user_id);

GRANT SELECT, INSERT ON public.crash_reports TO authenticated;
GRANT INSERT ON public.crash_reports TO anon;
GRANT ALL ON public.crash_reports TO service_role;

ALTER TABLE public.crash_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_crash_reports_any"
  ON public.crash_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "select_own_crash_reports"
  ON public.crash_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'));