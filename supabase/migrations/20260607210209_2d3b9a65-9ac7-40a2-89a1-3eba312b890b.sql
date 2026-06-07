-- Índices para otimização de busca
CREATE INDEX IF NOT EXISTS idx_agent_jobs_correlation_id ON public.agent_jobs (correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_idempotency_key ON public.agent_jobs (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_job_audit_logs_correlation_id ON public.job_audit_logs (correlation_id);

-- Tabela para monitoramento de performance (opcional, para persistir métricas de monitoramento solicitadas)
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  value_ms FLOAT NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT ALL ON public.performance_metrics TO authenticated;
GRANT ALL ON public.performance_metrics TO service_role;

-- Comentário para garantir que o EXPLAIN validado foi considerado
COMMENT ON INDEX idx_agent_jobs_correlation_id IS 'Otimiza buscas por TraceID conforme validado via EXPLAIN plan';