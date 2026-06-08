CREATE TABLE IF NOT EXISTS public.creative_filter_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_filter_presets TO authenticated;
GRANT ALL ON public.creative_filter_presets TO service_role;
ALTER TABLE public.creative_filter_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own filter presets" ON public.creative_filter_presets 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.creative_export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES public.creative_audit_schedules(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'processing', -- processing, completed, failed
    file_url TEXT,
    format TEXT NOT NULL, -- csv, json
    item_count INTEGER DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_export_history TO authenticated;
GRANT ALL ON public.creative_export_history TO service_role;
ALTER TABLE public.creative_export_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own export history" ON public.creative_export_history 
    FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.creative_export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    export_id UUID REFERENCES public.creative_export_history(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info', -- info, warning, error
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_export_logs TO authenticated;
GRANT ALL ON public.creative_export_logs TO service_role;
ALTER TABLE public.creative_export_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own export logs" ON public.creative_export_logs 
    FOR SELECT USING (auth.uid() = user_id);

-- Add interval support to creative_audit_schedules if not exists
ALTER TABLE public.creative_audit_schedules ADD COLUMN IF NOT EXISTS export_interval_days INTEGER DEFAULT 7;
ALTER TABLE public.creative_audit_schedules ADD COLUMN IF NOT EXISTS last_error_notified_at TIMESTAMP WITH TIME ZONE;
