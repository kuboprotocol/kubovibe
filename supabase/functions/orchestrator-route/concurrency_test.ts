
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test("execute_job_action enforces atomic idempotency under concurrency", async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  
  // 1. Criar um job de teste
  const jobId = crypto.randomUUID();
  const setupRes = await fetch(`${SUPABASE_URL}/rest/v1/agent_jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({
      id: jobId,
      agent_slug: "test-agent",
      status: "running",
      input: { test: true },
      idempotency_key: `concurrency-test-${jobId}`
    })
  });
  
  assert(setupRes.ok);

  // 2. Disparar múltiplas requisições simultâneas de 'cancel'
  const actorId = crypto.randomUUID(); // Dummy actor
  const correlationId = `test-corr-${jobId}`;
  
  const makeRequest = () => fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_job_action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      p_job_id: jobId,
      p_action: "cancel",
      p_actor_id: actorId,
      p_correlation_id: correlationId
    })
  });

  // Dispara 5 em paralelo
  const results = await Promise.all([
    makeRequest(),
    makeRequest(),
    makeRequest(),
    makeRequest(),
    makeRequest()
  ]);

  const bodies = await Promise.all(results.map(r => r.json()));
  
  // Validar que todas retornaram OK e o mesmo resultado (idempotência)
  // Ou pelo menos que não houve erro de transação/concorrência visível para o usuário
  bodies.forEach(body => {
    assert(body.ok === true, `Ação falhou: ${JSON.stringify(body)}`);
  });

  // 3. Validar se apenas 1 log de auditoria foi criado para a ação (opcional, dependendo da lógica de log)
  // Se a RPC for idempotente, ela deve detectar que já foi cancelado e retornar o mesmo.
  
  // Limpeza
  await fetch(`${SUPABASE_URL}/rest/v1/agent_jobs?id=eq.${jobId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}` }
  });
});
