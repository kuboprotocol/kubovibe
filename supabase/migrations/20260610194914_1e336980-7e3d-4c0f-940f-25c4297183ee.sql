-- Robust storage policies
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Ensure profiles can be created during signup
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = id);

-- Ensure projects can be created
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.profiles TO authenticated, service_role;
GRANT ALL ON public.projects TO authenticated, service_role;
GRANT ALL ON public.support_tickets TO authenticated, service_role;
