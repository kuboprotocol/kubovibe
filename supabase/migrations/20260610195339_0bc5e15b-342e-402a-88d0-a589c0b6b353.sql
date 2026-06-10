-- 1. Limpeza de políticas conflitantes no Storage
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own audit reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar metadata" ON storage.objects;
DROP POLICY IF EXISTS "Users read own audit reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own audit reports" ON storage.objects;

-- 2. Novas Políticas Robustas de Storage (Baseadas em UUID do usuário na pasta raiz)
-- INSERT: Permite upload se o bucket for válido e a primeira pasta for o UID do usuário
CREATE POLICY "Authenticated users can upload own files" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id IN ('uploads', 'avatars', 'audit-reports') 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: Permite visualizar se for dono do arquivo
CREATE POLICY "Authenticated users can view own files" 
ON storage.objects FOR SELECT TO authenticated 
USING (
  bucket_id IN ('uploads', 'avatars', 'audit-reports') 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Permite atualizar se for dono
CREATE POLICY "Authenticated users can update own files" 
ON storage.objects FOR UPDATE TO authenticated 
USING (
  bucket_id IN ('uploads', 'avatars', 'audit-reports') 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN ('uploads', 'avatars', 'audit-reports') 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Permite deletar se for dono
CREATE POLICY "Authenticated users can delete own files" 
ON storage.objects FOR DELETE TO authenticated 
USING (
  bucket_id IN ('uploads', 'avatars', 'audit-reports') 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Garantia de acesso público para avatars (se necessário para visualização geral)
CREATE POLICY "Public access for avatars" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'avatars');

-- 4. Correção de permissões em tabelas de metadados (Creative Assets e Auditoria)
GRANT ALL ON public.creative_assets TO authenticated, service_role;
GRANT ALL ON public.creative_audit_logs TO authenticated, service_role;

-- Garantir que as tabelas tenham RLS ativo e políticas de inserção corretas
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own creative assets" ON public.creative_assets;
CREATE POLICY "Users insert own creative assets" ON public.creative_assets 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.creative_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.creative_audit_logs;
CREATE POLICY "Users can insert their own audit logs" ON public.creative_audit_logs 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
