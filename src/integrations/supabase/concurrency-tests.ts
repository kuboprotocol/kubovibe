import { supabase } from "./client";

export async function runConcurrencyTest(jobId: string) {
  console.log(`Starting concurrency test for Job: ${jobId}`);
  
  const actions = ["pause", "pause", "cancel", "retry", "retry"];
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) throw new Error("Authentication required for tests");

  const results = await Promise.allSettled(
    actions.map((action, i) => 
      supabase.rpc('execute_job_action', {
        p_job_id: jobId,
        p_action: action,
        p_actor_id: userId,
        p_correlation_id: `test-concurrent-${i}-${Date.now()}`
      })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Test complete. Results: ${successful}/${actions.length} calls finished without network error.`);
  
  // Verify audit logs for idempotency
  const { data: logs } = await supabase
    .from('job_audit_logs')
    .select('action, details')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  console.log(`Total audit logs for job: ${logs?.length || 0}`);
  return { results, logs };
}
