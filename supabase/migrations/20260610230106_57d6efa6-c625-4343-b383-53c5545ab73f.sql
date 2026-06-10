CREATE TABLE public.filter_presets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    sorting JSONB NOT NULL DEFAULT '{"column": "created_at", "direction": "desc"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.filter_presets TO authenticated;
GRANT ALL ON public.filter_presets TO service_role;

ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own presets" ON public.filter_presets
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_filter_presets_updated_at
    BEFORE UPDATE ON public.filter_presets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();