-- 1. Revoke existing broad grants
REVOKE ALL ON TABLE public.api_credentials FROM authenticated;
REVOKE ALL ON TABLE public.api_credentials FROM public;

-- 2. Grant ALL to service_role (needed for backend decrypt/encrypt)
GRANT ALL ON TABLE public.api_credentials TO service_role;

-- 3. Grant specific SELECT to authenticated users (hiding sensitive columns like ciphertext, iv, tag)
GRANT SELECT (id, user_id, connector_slug, masked_hint, created_at, updated_at) ON public.api_credentials TO authenticated;

-- 4. Grant INSERT, UPDATE, DELETE to authenticated users so they can manage their own records
GRANT INSERT, UPDATE, DELETE ON public.api_credentials TO authenticated;

-- Ensure RLS is enabled (it already is, but good to be explicit)
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;