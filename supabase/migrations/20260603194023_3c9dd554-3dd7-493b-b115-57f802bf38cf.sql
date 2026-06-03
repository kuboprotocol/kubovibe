ALTER TABLE public.creative_assets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.creative_assets;