-- Adicionar colunas de rastreamento se não existirem
ALTER TABLE public.agent_jobs 
ADD COLUMN IF NOT EXISTS correlation_id TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela de auditoria de jobs
CREATE TABLE IF NOT EXISTS public.job_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'started', 'paused', 'resumed', 'cancelled', 'failed', 'completed', 'retry'
    details JSONB DEFAULT '{}'::jsonb,
    correlation_id TEXT,
    actor_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT ON public.job_audit_logs TO authenticated;
GRANT ALL ON public.job_audit_logs TO service_role;

-- RLS
ALTER TABLE public.job_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their own jobs" ON public.job_audit_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.agent_jobs 
        WHERE agent_jobs.id = job_audit_logs.job_id 
        AND agent_jobs.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert audit logs for their own jobs" ON public.job_audit_logs
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.agent_jobs 
        WHERE agent_jobs.id = job_audit_logs.job_id 
        AND agent_jobs.user_id = auth.uid()
    )
);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_job_audit_logs_job_id ON public.job_audit_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_correlation_id ON public.agent_jobs(correlation_id);
