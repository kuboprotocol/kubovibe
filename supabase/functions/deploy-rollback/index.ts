// Admin-only: rollback to the last healthy deployment by redeploying its commit SHA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jh = (s: any, status = 200) => new Response(JSON.stringify(s), { status, headers: { ...corsHeaders, "content-type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jh({ error: "unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jh({ error: "unauthorized" }, 401);

    const { data: isAdmin } = await supa.rpc("has_role", { _role: "admin" });
    if (!isAdmin) return jh({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body.target_id;
    const automated: boolean = !!body.automated;

    // Find target = explicit, else last healthy ready deployment that's NOT current
    let query = supa.from("deployments").select("*").eq("status", "ready").eq("healthy", true);
    if (targetId) query = query.eq("id", targetId);
    else query = query.eq("is_current", false).order("started_at", { ascending: false }).limit(1);
    const { data: targets } = await query;
    const target = targets?.[0];
    if (!target?.commit_sha) return jh({ error: "no healthy deployment with a commit to roll back to" }, 404);

    const hookUrl = Deno.env.get("VERCEL_DEPLOY_HOOK_URL") || Deno.env.get("LOVABLE_DEPLOY_HOOK_URL");
    if (!hookUrl) return jh({ error: "deploy hook not configured" }, 500);
    const hookFinal = `${hookUrl}${hookUrl.includes("?") ? "&" : "?"}sha=${encodeURIComponent(target.commit_sha)}`;

    const reason = automated ? "Automatic rollback: healthcheck failed" : `Manual rollback to ${target.commit_sha.slice(0, 7)}`;
    const now = new Date().toISOString();
    const { data: inserted, error } = await supa.from("deployments").insert({
      source: automated ? "auto-rollback" : "rollback",
      provider: hookUrl.includes("vercel") ? "vercel" : "lovable",
      status: "queued",
      triggered_by: user.id,
      trigger_reason: reason,
      commit_sha: target.commit_sha,
      commit_message: `[ROLLBACK] ${target.commit_message ?? ""}`,
      rolled_back_to: target.id,
      log: `[${now}] QUEUED — ${reason}\n`,
    }).select().single();
    if (error) return jh({ error: error.message }, 500);

    const hookRes = await fetch(hookFinal, { method: "POST" });
    const ok = hookRes.ok;
    await supa.from("deployments").update({
      status: ok ? "building" : "error",
      log: `[${now}] QUEUED — ${reason}\n[${new Date().toISOString()}] ROLLBACK HOOK ${ok ? "OK" : "FAILED"} (${hookRes.status})\n`,
    }).eq("id", inserted.id);

    return jh({ ok: true, id: inserted.id, target_sha: target.commit_sha });
  } catch (e) {
    return jh({ error: (e as Error).message }, 500);
  }
});
