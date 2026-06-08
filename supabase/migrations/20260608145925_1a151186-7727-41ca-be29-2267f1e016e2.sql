-- Update creative_filter_presets with created_by if not exists
ALTER TABLE public.creative_filter_presets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Enhance creative_export_history for cancellation and retries
ALTER TABLE public.creative_export_history ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.creative_export_history ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE public.creative_export_history ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.creative_export_history ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.creative_export_history ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMP WITH TIME ZONE;

-- Create audit log for investigation
CREATE TABLE IF NOT EXISTS public.creative_export_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES public.creative_export_history(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'create', 'cancel', 'retry', 'fail', 'success'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_creative_export_audit_log_export_id ON public.creative_export_audit_log(export_id);
CREATE INDEX IF NOT EXISTS idx_creative_export_history_user_id ON public.creative_export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_user_id_status ON public.creative_assets(user_id, status);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.creative_export_history TO authenticated;
GRANT SELECT, INSERT ON public.creative_export_audit_log TO authenticated;
GRANT ALL ON public.creative_export_history TO service_role;
GRANT ALL ON public.creative_export_audit_log TO service_role;

-- RLS
ALTER TABLE public.creative_export_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export audit logs" 
ON public.creative_export_audit_log FOR SELECT 
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.creative_export_history e 
    WHERE e.id = export_id AND e.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own export audit logs" 
ON public.creative_export_audit_log FOR INSERT 
WITH CHECK (auth.uid() = user_id);
