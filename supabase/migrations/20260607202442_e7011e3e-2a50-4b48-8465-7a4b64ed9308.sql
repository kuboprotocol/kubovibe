-- Atualizar constraint de status na tabela agent_jobs
ALTER TABLE public.agent_jobs DROP CONSTRAINT IF EXISTS agent_jobs_status_check;
ALTER TABLE public.agent_jobs ADD CONSTRAINT agent_jobs_status_check 
CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'processing'::text, 'paused'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text, 'completed'::text]));
