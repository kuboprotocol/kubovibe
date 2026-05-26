
CREATE TABLE public.render_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Render',
  api_key_ciphertext text NOT NULL,
  api_key_iv text NOT NULL,
  api_key_tag text NOT NULL,
  api_key_hint text,
  workspace_id text,
  last_status text NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  last_latency_ms integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.render_connections TO authenticated;
GRANT ALL ON public.render_connections TO service_role;
ALTER TABLE public.render_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "render conn owner select" ON public.render_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "render conn owner insert" ON public.render_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "render conn owner update" ON public.render_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "render conn owner delete" ON public.render_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "render conn service role" ON public.render_connections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER render_connections_touch BEFORE UPDATE ON public.render_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.render_auto_heal_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.render_connections(id) ON DELETE CASCADE,
  service_id text NOT NULL,
  service_name text,
  enabled boolean NOT NULL DEFAULT true,
  health_url text,
  max_restarts_per_hour integer NOT NULL DEFAULT 5,
  rollback_on_fail boolean NOT NULL DEFAULT true,
  e2e_webhook_url text,
  e2e_run_on_deploy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.render_auto_heal_policies TO authenticated;
GRANT ALL ON public.render_auto_heal_policies TO service_role;
ALTER TABLE public.render_auto_heal_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "render policy owner all" ON public.render_auto_heal_policies FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "render policy service role" ON public.render_auto_heal_policies FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER render_policies_touch BEFORE UPDATE ON public.render_auto_heal_policies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.render_heal_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES public.render_connections(id) ON DELETE SET NULL,
  service_id text NOT NULL,
  action text NOT NULL,
  trigger text NOT NULL,
  status text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.render_heal_events TO authenticated;
GRANT ALL ON public.render_heal_events TO service_role;
ALTER TABLE public.render_heal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "render heal owner select" ON public.render_heal_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "render heal owner insert" ON public.render_heal_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "render heal service role" ON public.render_heal_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE INDEX render_heal_events_user_created_idx ON public.render_heal_events (user_id, created_at DESC);
CREATE INDEX render_heal_events_service_idx ON public.render_heal_events (service_id, created_at DESC);
