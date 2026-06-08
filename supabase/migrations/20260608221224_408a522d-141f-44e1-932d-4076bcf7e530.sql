ALTER TABLE public.creative_user_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_user_settings TO authenticated;
GRANT ALL ON public.creative_user_settings TO service_role;
