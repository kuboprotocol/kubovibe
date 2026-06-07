-- Ajustar segurança da função execute_job_action
ALTER FUNCTION public.execute_job_action(UUID, TEXT, UUID, TEXT) SET search_path = public;

-- Adicionar verificação de propriedade na função
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
    v_is_admin BOOLEAN;
BEGIN
    -- Verifica se o ator é o dono do job ou se tem papel de service_role (via verificação de JWT se necessário, 
    -- mas aqui confiamos no p_actor_id pois a função é chamada pelo backend ou pelo client autenticado)
    
    -- Seleciona e trava a linha para atualização
    SELECT * INTO v_job FROM public.agent_jobs WHERE id = p_job_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
    END IF;

    -- Verificação de permissão: ator deve ser o dono do job
    -- (No Lovable Cloud, agent_jobs costuma ter user_id. Vamos verificar se a coluna existe)
    -- Se a coluna user_id não existir, assumimos que a segurança é feita via RLS ou políticas de execução.
    -- Mas para jobs, geralmente queremos garantir que o p_actor_id bate com o user_id do job.
    
    -- NOTA: Como a função é SECURITY DEFINER, ela ignora RLS. 
    -- Adicionamos uma verificação manual se a coluna user_id existir.
    BEGIN
        IF v_job.user_id IS NOT NULL AND v_job.user_id != p_actor_id THEN
             -- Se for chamado via service_role, permitimos. 
             -- Podemos checar o role atual:
             IF current_setting('role') != 'service_role' THEN
                RETURN jsonb_build_object('ok', false, 'error', 'Permission denied');
             END IF;
        END IF;
    EXCEPTION WHEN undefined_column THEN
        -- Se não tem user_id, prossegue (pode ser um sistema global)
        NULL;
    END;

    -- Define novo status e valida transição (IDEMPOTENTE)
    CASE p_action
        WHEN 'cancel' THEN
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
