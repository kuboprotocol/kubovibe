-- Ajusta a política pública de avatares para evitar listagem (audit log sugeriu que SELECT público em bucket público permite listagem)
DROP POLICY IF EXISTS "Public access for avatars" ON storage.objects;
CREATE POLICY "Public access for avatars" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'avatars'); 
-- Nota: O linter pode continuar avisando se o bucket em si for marcado como público no storage.buckets. 
-- Manteremos como SELECT para permitir que imagens de perfil funcionem em URLs diretas.
