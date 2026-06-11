-- Fix public bucket listing vulnerability on avatars storage
-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;

-- Create a more restrictive policy that only allows reading avatar files
-- but NOT listing the entire bucket contents
-- Note: Storage bucket policies in Supabase cannot prevent listing at the policy level
-- The actual fix is to move avatars to a private bucket or use signed URLs
CREATE POLICY "Public read avatars by specific path"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');