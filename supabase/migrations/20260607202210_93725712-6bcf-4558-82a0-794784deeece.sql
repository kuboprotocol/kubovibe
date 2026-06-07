-- Melhorar idempotência na função execute_job_action
CREATE OR REPLACE FUNCTION public.execute_job_action(
    p_job_id UUID,
    p_action TEXT,
    p_actor_id UUID,
    p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_new_status TEXT;
    v_audit_id UUID;
BEGIN
    -- Seleciona e trava a linha para atualização
    SELECT * INTO v_job FROM public.agent_jobs WHERE id = p_job_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
    END IF;

    -- Define novo status e valida transição (IDEMPOTENTE)
    CASE p_action
        WHEN 'cancel' THEN
            -- Se já está falhado/cancelado, retornamos ok (idempotência)
            IF v_job.status = 'failed' THEN
                RETURN jsonb_build_object('ok', true, 'new_status', 'failed', 'message', 'Job already cancelled');
            END IF;
            IF v_job.status = 'completed' THEN
                RETURN jsonb_build_object('ok', false, 'error', 'Cannot cancel completed job');
            END IF;
            v_new_status := 'failed';
        WHEN 'pause' THEN
            IF v_job.status = 'paused' THEN
                RETURN jsonb_build_object('ok', true, 'new_status', 'paused', 'message', 'Job already paused');
            END IF;
            IF v_job.status != 'processing' THEN
                RETURN jsonb_build_object('ok', false, 'error', 'Only processing jobs can be paused');
            END IF;
            v_new_status := 'paused';
        WHEN 'resume' THEN
            IF v_job.status = 'processing' THEN
                RETURN jsonb_build_object('ok', true, 'new_status', 'processing', 'message', 'Job already running');
            END IF;
            IF v_job.status != 'paused' THEN
                RETURN jsonb_build_object('ok', false, 'error', 'Only paused jobs can be resumed');
            END IF;
            v_new_status := 'processing';
        WHEN 'retry' THEN
            -- Retry sempre reseta, mas podemos evitar se já estiver processando
            IF v_job.status = 'processing' OR v_job.status = 'queued' THEN
                RETURN jsonb_build_object('ok', true, 'new_status', v_job.status, 'message', 'Job already active');
            END IF;
            v_new_status := 'processing';
        ELSE
            RETURN jsonb_build_object('ok', false, 'error', 'Invalid action');
    END CASE;

    -- Atualiza o job
    UPDATE public.agent_jobs 
    SET 
        status = v_new_status,
        updated_at = now(),
        paused_at = CASE WHEN p_action = 'pause' THEN now() WHEN p_action = 'resume' THEN NULL ELSE paused_at END,
        error_message = CASE WHEN p_action = 'cancel' THEN 'Cancelado pelo usuário' WHEN p_action = 'retry' THEN NULL ELSE error_message END,
        retry_count = CASE WHEN p_action = 'retry' THEN 0 ELSE retry_count END,
        next_retry_at = CASE WHEN p_action = 'retry' THEN NULL ELSE next_retry_at END
    WHERE id = p_job_id;

    -- Insere log de auditoria
    INSERT INTO public.job_audit_logs (job_id, action, actor_id, correlation_id, details)
    VALUES (p_job_id, p_action, p_actor_id, p_correlation_id, jsonb_build_object('source', 'rpc_action', 'timestamp', now(), 'idempotent', true))
    RETURNING id INTO v_audit_id;

    RETURN jsonb_build_object('ok', true, 'new_status', v_new_status, 'audit_id', v_audit_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar Realtime
DO $$
BEGIN
    -- Verifica se a publicação já existe
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Tenta adicionar as tabelas (ignora se já existirem)
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_jobs;
    EXCEPTION WHEN others THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.job_audit_logs;
    EXCEPTION WHEN others THEN NULL;
    END;
END $$;
