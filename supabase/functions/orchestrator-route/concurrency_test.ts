
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.211.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.test("execute_job_action atomic idempotency under concurrency", async () => {
  if (!SERVICE_ROLE_KEY) {
    console.warn("Skipping test: SUPABASE_SERVICE_ROLE_KEY not found");
    return;
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  
  // 1. Create a dummy job
  const { data: job, error: createError } = await supabase
    .from('agent_jobs')
    .insert({
      agent_slug: 'test-agent',
      status: 'processing',
      input: { test: true },
      correlation_id: `test-corr-${Date.now()}`
    })
    .select()
    .single();
    
  if (createError) throw createError;
  
  // 2. Simulate concurrent cancel requests
  const actorId = '00000000-0000-0000-0000-000000000000'; // mock
  const action = 'cancel';
  
  const promises = Array.from({ length: 5 }).map(() => 
    supabase.rpc('execute_job_action', {
      p_job_id: job.id,
      p_action: action,
      p_actor_id: actorId,
      p_correlation_id: `test-web-${Date.now()}`
    })
  );
  
  const results = await Promise.all(promises);
  
  // 3. Verify results
  const successfulActions = results.filter(r => r.data?.ok === true);
  const alreadyCancelled = results.filter(r => r.data?.message === 'Job already cancelled');
  
  // At least one must be ok. Depending on race conditions, others might be 'already cancelled'
  assertNotEquals(successfulActions.length, 0, "At least one request should succeed");
  
  // Total success (either newly changed or already in that state) should be all
  assertEquals(results.every(r => r.data?.ok === true), true, "All requests should return ok (idempotency)");
  
  // Cleanup
  await supabase.from('agent_jobs').delete().eq('id', job.id);
});
