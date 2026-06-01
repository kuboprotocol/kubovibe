
-- Table to track skill ZIP uploads
CREATE TABLE public.skill_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','registered','failed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_imports TO authenticated;
GRANT ALL ON public.skill_imports TO service_role;

ALTER TABLE public.skill_imports ENABLE ROW LEVEL SECURITY;

-- Helper: is current user the admin?
CREATE OR REPLACE FUNCTION public.is_skill_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = 'kuboprotocol@gmail.com'
  );
$$;

CREATE POLICY "admin reads skill_imports" ON public.skill_imports
  FOR SELECT TO authenticated USING (public.is_skill_admin());
CREATE POLICY "admin inserts skill_imports" ON public.skill_imports
  FOR INSERT TO authenticated WITH CHECK (public.is_skill_admin() AND uploaded_by = auth.uid());
CREATE POLICY "admin updates skill_imports" ON public.skill_imports
  FOR UPDATE TO authenticated USING (public.is_skill_admin()) WITH CHECK (public.is_skill_admin());
CREATE POLICY "admin deletes skill_imports" ON public.skill_imports
  FOR DELETE TO authenticated USING (public.is_skill_admin());

-- Private bucket for skill ZIPs
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-uploads', 'skill-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin reads skill zips" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'skill-uploads' AND public.is_skill_admin());

CREATE POLICY "admin uploads skill zips" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skill-uploads' AND public.is_skill_admin());

CREATE POLICY "admin deletes skill zips" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'skill-uploads' AND public.is_skill_admin());
