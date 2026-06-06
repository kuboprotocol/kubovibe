-- 1) project_versions: drop public/anon read of generated_code
DROP POLICY IF EXISTS "Anyone can view published project versions" ON public.project_versions;

-- 2) kubo_domain_transfers.auth_code: revoke column-level read for owners
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM authenticated;
REVOKE SELECT (auth_code) ON public.kubo_domain_transfers FROM anon;

-- 3) shortlink_clicks.ip_address: revoke column-level read
REVOKE SELECT (ip_address) ON public.shortlink_clicks FROM authenticated;
REVOKE SELECT (ip_address) ON public.shortlink_clicks FROM anon;

-- 4) uploads bucket: explicit owner-scoped UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Users can update own uploads'
  ) THEN
    CREATE POLICY "Users can update own uploads" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;