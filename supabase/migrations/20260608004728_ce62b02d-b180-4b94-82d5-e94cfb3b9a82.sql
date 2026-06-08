-- Change execute_job_action to SECURITY INVOKER
-- This ensures it uses the caller's privileges (authenticated user) and RLS.
-- Since authenticated users already have ALL privileges on their own jobs and audit logs, this is secure.

CREATE OR REPLACE FUNCTION public.execute_job_action(p_job_id uuid, p_action text, p_actor_id uuid, p_correlation_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_job RECORD;
    v_new_status TEXT;
    v_audit_id UUID;
    v_resolved_actor UUID;
BEGIN
    -- Use auth.uid() if available (trusted), otherwise fallback to parameter (for service_role)
    v_resolved_actor := COALESCE(auth.uid(), p_actor_id);

    -- Seleciona e trava a linha para atualização. 
    -- SECURITY INVOKER will enforce RLS here.
    SELECT * INTO v_job FROM public.agent_jobs WHERE id = p_job_id FOR UPDATE;
    
    IF NOT FOUND THEN
        -- If RLS filters it out, it will look like 'Not found' to the user, which is correct.
        RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
    END IF;

    -- Verificação de permissão redundante (RLS já garante isso se invocado por usuário)
    IF auth.role() != 'service_role' THEN
        IF v_job.user_id IS NOT NULL AND v_job.user_id != v_resolved_actor THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Permission denied');
        END IF;
    END IF;

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
    VALUES (p_job_id, p_action, v_resolved_actor, p_correlation_id, jsonb_build_object('source', 'rpc_action', 'timestamp', now(), 'idempotent', true))
    RETURNING id INTO v_audit_id;

    RETURN jsonb_build_object('ok', true, 'new_status', v_new_status, 'audit_id', v_audit_id);
END;
$function$;
