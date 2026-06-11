-- Table for background export jobs
CREATE TABLE IF NOT EXISTS public.pwa_telemetry_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, cancelled, failed
    filters JSONB DEFAULT '{}'::jsonb,
    format TEXT NOT NULL, -- csv, json
    progress INTEGER DEFAULT 0,
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Settings for anomaly notifications
CREATE TABLE IF NOT EXISTS public.pwa_telemetry_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    webhook_url TEXT,
    is_notifications_enabled BOOLEAN DEFAULT false,
    anomaly_threshold_sigma DECIMAL DEFAULT 2.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.pwa_telemetry_export_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pwa_telemetry_export_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.pwa_telemetry_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pwa_telemetry_settings TO service_role;

-- RLS
ALTER TABLE public.pwa_telemetry_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_telemetry_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own export jobs" ON public.pwa_telemetry_export_jobs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own settings" ON public.pwa_telemetry_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins can see everything
CREATE POLICY "Admins can view all jobs" ON public.pwa_telemetry_export_jobs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin', 'analyst')
        )
    );

CREATE POLICY "Admins can view all settings" ON public.pwa_telemetry_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pwa_telemetry_export_jobs_updated_at
    BEFORE UPDATE ON public.pwa_telemetry_export_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pwa_telemetry_settings_updated_at
    BEFORE UPDATE ON public.pwa_telemetry_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
