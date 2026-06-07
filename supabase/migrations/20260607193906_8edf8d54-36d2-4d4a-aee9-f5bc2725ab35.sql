CREATE TABLE IF NOT EXISTS public.orchestrator_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL, -- e.g. 'disabled_agents' or 'disabled_categories'
    value JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orchestrator_config TO authenticated;
GRANT ALL ON public.orchestrator_config TO service_role;

ALTER TABLE public.orchestrator_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage orchestrator_config" ON public.orchestrator_config
    FOR ALL USING (has_role('admin')) WITH CHECK (has_role('admin'));

CREATE POLICY "Everyone can view orchestrator_config" ON public.orchestrator_config
    FOR SELECT USING (true);

-- Update agent_jobs if columns don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='agent_jobs' AND COLUMN_NAME='retry_count') THEN
        ALTER TABLE public.agent_jobs ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='agent_jobs' AND COLUMN_NAME='last_error') THEN
        ALTER TABLE public.agent_jobs ADD COLUMN last_error TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='agent_jobs' AND COLUMN_NAME='next_retry_at') THEN
        ALTER TABLE public.agent_jobs ADD COLUMN next_retry_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='agent_jobs' AND COLUMN_NAME='idempotency_key') THEN
        ALTER TABLE public.agent_jobs ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;
END $$;
