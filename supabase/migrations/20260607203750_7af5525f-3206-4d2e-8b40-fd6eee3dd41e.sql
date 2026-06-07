CREATE INDEX IF NOT EXISTS idx_agent_jobs_correlation_id ON public.agent_jobs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_idempotency_key ON public.agent_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_job_audit_logs_job_id ON public.job_audit_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_audit_logs_correlation_id ON public.job_audit_logs(correlation_id);
