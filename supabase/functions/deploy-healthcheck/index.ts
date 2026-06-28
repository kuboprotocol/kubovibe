// Pings the production URL of the current deployment. If unhealthy for 3 consecutive
// checks (tracked via meta.consecutive_failures), triggers automatic rollback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FAILURE_THRESHOLD = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: current } = await supa.from("deployments").select("*").eq("is_current", true).maybeSingle();
  if (!current) {
    return new Response(JSON.stringify({ ok: true, message: "no current deployment" }),
      { headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const healthUrl = current.url || "https://kubovibe.dev";
  let healthy = false;
  let detail = "";
  try {
    const res = await fetch(healthUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    healthy = res.ok;
    detail = `HEAD ${res.status}`;
  } catch (e) { detail = `error: ${(e as Error).message}`; }

  const failures = healthy ? 0 : ((current.meta?.consecutive_failures ?? 0) + 1);
  await supa.from("deployments").update({
    healthy,
    meta: { ...(current.meta || {}), consecutive_failures: failures, last_check_at: new Date().toISOString(), last_check_detail: detail },
  }).eq("id", current.id);

  let rolled_back: any = null;
  if (failures >= FAILURE_THRESHOLD) {
    // Find last healthy deployment with a commit (not current)
    const { data: target } = await supa.from("deployments").select("*")
      .eq("status", "ready").eq("healthy", true).neq("id", current.id)
      .not("commit_sha", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (target) {
      const hookUrl = Deno.env.get("VERCEL_DEPLOY_HOOK_URL") || Deno.env.get("LOVABLE_DEPLOY_HOOK_URL");
      if (hookUrl) {
        const final = `${hookUrl}${hookUrl.includes("?") ? "&" : "?"}sha=${encodeURIComponent(target.commit_sha)}`;
        const r = await fetch(final, { method: "POST" }).catch(() => null);
        const { data: inserted } = await supa.from("deployments").insert({
          source: "auto-rollback",
          provider: hookUrl.includes("vercel") ? "vercel" : "lovable",
          status: r?.ok ? "building" : "error",
          trigger_reason: `Auto-rollback: ${FAILURE_THRESHOLD} consecutive healthcheck failures (${detail})`,
          commit_sha: target.commit_sha,
          commit_message: `[AUTO-ROLLBACK] ${target.commit_message ?? ""}`,
          rolled_back_to: target.id,
          log: `[${new Date().toISOString()}] AUTO-ROLLBACK triggered after ${failures} failures (${detail}). Redeploying ${target.commit_sha.slice(0, 7)}.\n`,
        }).select().single();
        rolled_back = inserted;
        // reset failure counter on the broken deployment
        await supa.from("deployments").update({ meta: { ...(current.meta || {}), consecutive_failures: 0, auto_rollback_id: inserted?.id } }).eq("id", current.id);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, healthy, failures, rolled_back: rolled_back?.id ?? null }),
    { headers: { ...corsHeaders, "content-type": "application/json" } });
});
