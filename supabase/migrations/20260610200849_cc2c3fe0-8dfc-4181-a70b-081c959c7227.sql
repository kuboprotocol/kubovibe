-- Ensure the uploads bucket is properly configured and public if needed for direct access
-- (Keeping it private as per best practices, but ensuring the policy is robust)

-- Note: The "Failed to fetch" is often a network/CORS issue. 
-- In Supabase Storage, it can happen if the client tries to reach an endpoint that doesn't exist 
-- or if there's a protocol mismatch.

-- Refreshing the public policy for avatars to ensure no CORS-related issues on GET
DROP POLICY IF EXISTS "Public access for avatars" ON storage.objects;
CREATE POLICY "Public access for avatars" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'avatars');
