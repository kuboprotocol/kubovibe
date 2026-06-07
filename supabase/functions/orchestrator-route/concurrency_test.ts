import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.test("Atomic Idempotency: Concurrent Job Actions", async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  // 1. Create a dummy job
  const { data: job, error: createError } = await supabase
    .from("agent_jobs")
    .insert({
      agent_slug: "test-agent",
      status: "processing",
      input: { test: true },
      idempotency_key: `test-concurrency-${Date.now()}`
    })
    .select()
    .single();
    
  if (createError) throw createError;
  assert(job, "Job should be created");

  // 2. Perform concurrent actions (Pause)
  const correlationId = `test-action-${Date.now()}`;
  const actorId = "00000000-0000-0000-0000-000000000000"; // Admin/System
  
  // Launch 5 concurrent pause requests
  const results = await Promise.all(
    Array.from({ length: 5 }).map(() => 
      supabase.rpc('execute_job_action', {
        p_job_id: job.id,
        p_action: 'pause',
        p_actor_id: actorId,
        p_correlation_id: correlationId
      })
    )
  );

  // 3. Verify results
  // All should return ok: true because of idempotency
  for (const res of results) {
    if (res.error) {
      console.error("RPC Error:", res.error);
    }
    assertEquals(res.data?.ok, true, "Each concurrent call should be idempotent and return ok");
  }

  // 4. Check final status
  const { data: updatedJob } = await supabase
    .from("agent_jobs")
    .select("status")
    .eq("id", job.id)
    .single();
    
  assertEquals(updatedJob?.status, "paused", "Final status must be paused");

  // 5. Verify audit logs (should have at least one record, but could be one per call depending on if we log every idempotent hit)
  // In our RPC, we log every SUCCESSFUL action. 
  const { data: logs } = await supabase
    .from("job_audit_logs")
    .select("*")
    .eq("job_id", job.id)
    .eq("action", "pause");
    
  assert(logs && logs.length >= 1, "Should have at least one audit log for the action");
  
  // Cleanup
  await supabase.from("job_audit_logs").delete().eq("job_id", job.id);
  await supabase.from("agent_jobs").delete().eq("id", job.id);
});

Deno.test("TraceID Propagation: TraceID appears in Audit Logs", async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const traceId = `trace-${crypto.randomUUID()}`;
  
  const { data: job } = await supabase.from("agent_jobs").insert({
    agent_slug: "test-trace",
    status: "queued",
    correlation_id: traceId
  }).select().single();
  
  assert(job, "Job with traceId should be created");
  
  // Trigger an action with the same traceId/correlationId
  await supabase.rpc('execute_job_action', {
    p_job_id: job.id,
    p_action: 'retry',
    p_actor_id: "00000000-0000-0000-0000-000000000000",
    p_correlation_id: traceId
  });
  
  // Verify propagation in logs
  const { data: logs } = await supabase
    .from("job_audit_logs")
    .select("*")
    .eq("job_id", job.id)
    .eq("correlation_id", traceId);
    
  assert(logs && logs.length > 0, "TraceID should be propagated to audit logs");
  assertEquals(logs![0].correlation_id, traceId);
  
  // Cleanup
  await supabase.from("job_audit_logs").delete().eq("job_id", job.id);
  await supabase.from("agent_jobs").delete().eq("id", job.id);
});
