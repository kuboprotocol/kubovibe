-- Create internal schema for sensitive functions
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;

-- 1. Secure is_kubo_admin
-- Move current function to internal
ALTER FUNCTION public.is_kubo_admin() SET SCHEMA internal;
-- Create proxy in public as security invoker (linter safe)
CREATE OR REPLACE FUNCTION public.is_kubo_admin()
RETURNS boolean AS $$
BEGIN
  RETURN internal.is_kubo_admin();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 2. Secure is_skill_admin
-- Move current function to internal
ALTER FUNCTION public.is_skill_admin() SET SCHEMA internal;
-- Create proxy in public as security invoker (linter safe)
CREATE OR REPLACE FUNCTION public.is_skill_admin()
RETURNS boolean AS $$
BEGIN
  RETURN internal.is_skill_admin();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 3. Secure bump_rate_limit
-- Revoke execute from authenticated and anon
REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, uuid, integer) TO service_role;

-- 4. Fix Storage Bucket Listing (Linter WARN 1 & 2)
-- Avatars bucket: restrict listing to owners, rely on public bucket for direct file access
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
CREATE POLICY "Users can view own avatar metadata" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Uploads bucket: restrict listing to owners
DROP POLICY IF EXISTS "Public read access for uploads" ON storage.objects;
CREATE POLICY "Users can view own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Finalize permissions
GRANT EXECUTE ON FUNCTION public.is_kubo_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_skill_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_kubo_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_skill_admin() TO authenticated, service_role;
