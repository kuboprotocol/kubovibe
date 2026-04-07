CREATE TABLE public.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  generated_code text,
  title text NOT NULL,
  description text,
  published_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(project_id, version_number)
);

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project versions"
  ON public.project_versions FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own project versions"
  ON public.project_versions FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own project versions"
  ON public.project_versions FOR DELETE TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can view published project versions"
  ON public.project_versions FOR SELECT TO anon, authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE is_published = true));