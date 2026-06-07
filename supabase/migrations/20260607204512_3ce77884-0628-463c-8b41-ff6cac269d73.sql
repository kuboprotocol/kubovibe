-- Índices para otimizar busca por TraceID/CorrelationID
CREATE INDEX IF NOT EXISTS idx_agent_jobs_correlation_id ON public.agent_jobs (correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status_created ON public.agent_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_audit_logs_job_id_created ON public.job_audit_logs (job_id, created_at DESC);

-- Validar performance (comentado pois ferramentas de migração não mostram output de explain)
-- EXPLAIN ANALYZE SELECT * FROM agent_jobs WHERE correlation_id = 'some-uuid';
-- EXPLAIN ANALYZE SELECT * FROM job_audit_logs WHERE job_id = 'some-uuid' ORDER BY created_at DESC;
