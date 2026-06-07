import { describe, it, expect } from 'vitest';
import { supabase } from './client';

describe('Idempotência Atômica e Concorrência', () => {
  it('deve garantir que múltiplas requisições simultâneas de cancelamento resultem em apenas um log de auditoria', async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
       console.warn('Pulando teste: Usuário não autenticado');
       return;
    }

    // 1. Criar um job de teste
    const { data: job, error: createError } = await supabase
      .from('agent_jobs')
      .insert({
        agent_slug: 'test-agent',
        status: 'processing',
        input: { test: true },
        idempotency_key: `test-concurrent-${Date.now()}`,
        user_id: userId
      })
      .select()
      .single();

    if (createError) throw createError;
    expect(job).toBeDefined();

    // 2. Simular 5 requisições de cancelamento simultâneas
    const requests = Array(5).fill(null).map((_, i) => 
      supabase.rpc('execute_job_action', {
        p_job_id: job.id,
        p_action: 'cancel',
        p_actor_id: userId,
        p_correlation_id: `trace-concurrent-${i}-${Date.now()}`
      })
    );

    const results = await Promise.allSettled(requests);
    
    // 3. Verificar se o status final é cancelado
    const { data: updatedJob } = await supabase
      .from('agent_jobs')
      .select('status')
      .eq('id', job.id)
      .single();
    
    expect(updatedJob?.status).toBe('cancelled');

    // 4. CRITICAL: Verificar idempotência nos logs de auditoria
    const { data: logs } = await supabase
      .from('job_audit_logs')
      .select('action')
      .eq('job_id', job.id)
      .eq('action', 'cancel');

    expect(logs?.length).toBe(1);
  });

  it('deve lidar corretamente com ações conflitantes (pause/cancel) simultâneas', async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data: job } = await supabase
      .from('agent_jobs')
      .insert({
        agent_slug: 'test-agent',
        status: 'processing',
        input: { test: true },
        idempotency_key: `test-conflict-${Date.now()}`,
        user_id: userId
      })
      .select()
      .single();

    if (!job) return;

    // Disparar pause e cancel ao mesmo tempo
    const requests = [
      supabase.rpc('execute_job_action', { p_job_id: job.id, p_action: 'pause', p_actor_id: userId, p_correlation_id: 't1' }),
      supabase.rpc('execute_job_action', { p_job_id: job.id, p_action: 'cancel', p_actor_id: userId, p_correlation_id: 't2' })
    ];

    await Promise.allSettled(requests);

    const { data: finalJob } = await supabase.from('agent_jobs').select('status').eq('id', job.id).single();
    expect(['paused', 'cancelled']).toContain(finalJob?.status);
  });
});

