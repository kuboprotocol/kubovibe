
CREATE TABLE IF NOT EXISTS public.creative_filter_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filter TEXT NOT NULL,
    search_query TEXT,
    sort_order TEXT DEFAULT 'desc',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_filter_presets TO authenticated;
GRANT ALL ON public.creative_filter_presets TO service_role;
ALTER TABLE public.creative_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own presets" ON public.creative_filter_presets
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enhance export history for detailed tracking
ALTER TABLE public.creative_export_history 
ADD COLUMN IF NOT EXISTS included_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS item_ids TEXT[],
ADD COLUMN IF NOT EXISTS date_range_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS date_range_end TIMESTAMP WITH TIME ZONE;

-- Audit trail table for item re-processing
CREATE TABLE IF NOT EXISTS public.creative_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES public.creative_assets(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    tool TEXT,
    idempotency_key TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.creative_audit_logs TO authenticated;
GRANT ALL ON public.creative_audit_logs TO service_role;
ALTER TABLE public.creative_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.creative_audit_logs
    FOR SELECT USING (auth.uid() = user_id);
