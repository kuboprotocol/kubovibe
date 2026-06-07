-- 1. Hardening public.log_connector_activity
-- Revoke execute from public to enforce explicit roles
REVOKE EXECUTE ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_connector_activity(text, text, text, text, jsonb) TO service_role;

-- Switch to SECURITY INVOKER (it was SECURITY DEFINER)
-- This ensures it uses the caller's permissions and complies with best practices
ALTER FUNCTION public.log_connector_activity(text, text, text, text, jsonb) SECURITY INVOKER;

-- Add INSERT policy for authenticated users so they can log their own activity
CREATE POLICY "Users can insert own connector logs" 
ON public.connector_activity_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 2. Encrypting github_connections access_token
-- Add columns for encrypted storage
ALTER TABLE public.github_connections 
ADD COLUMN access_token_ciphertext TEXT,
ADD COLUMN access_token_iv TEXT,
ADD COLUMN access_token_tag TEXT;

-- Note: We keep access_token for now to avoid breaking existing code during migration,
-- but we will update the code to use the encrypted columns.
-- Future migration will drop the plain text access_token column.

GRANT ALL ON public.github_connections TO service_role;
GRANT SELECT, DELETE ON public.github_connections TO authenticated;
GRANT ALL ON public.connector_activity_logs TO service_role;
GRANT SELECT, INSERT, DELETE ON public.connector_activity_logs TO authenticated;
