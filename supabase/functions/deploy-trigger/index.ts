// Admin-only: trigger a manual redeploy by calling the configured deploy hook URL.
// Requires secret VERCEL_DEPLOY_HOOK_URL (or LOVABLE_DEPLOY_HOOK_URL).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jh = (s: any, status = 200) => new Response(JSON.stringify(s), { status, headers: { ...corsHeaders, "content-type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jh({ error: "unauthorized" }, 401);

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jh({ error: "unauthorized" }, 401);

    const { data: isAdmin } = await supa.rpc("has_role", { _role: "admin" });
    if (!isAdmin) return jh({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const reason: string = body.reason || "Manual redeploy";
    const commitSha: string | undefined = body.commit_sha;

    const hookUrl = Deno.env.get("VERCEL_DEPLOY_HOOK_URL") || Deno.env.get("LOVABLE_DEPLOY_HOOK_URL");
    if (!hookUrl) return jh({ error: "deploy hook not configured. Set VERCEL_DEPLOY_HOOK_URL." }, 500);

    const hookFinal = commitSha ? `${hookUrl}${hookUrl.includes("?") ? "&" : "?"}sha=${encodeURIComponent(commitSha)}` : hookUrl;

    // ETA prediction
    const { data: hist } = await supa.from("deployments")
      .select("duration_ms").eq("status", "ready").not("duration_ms", "is", null)
      .order("started_at", { ascending: false }).limit(10);
    const eta = hist?.length ? Math.round(hist.reduce((s: number, r: any) => s + (r.duration_ms || 0), 0) / hist.length) : null;

    const now = new Date().toISOString();
    const { data: inserted, error } = await supa.from("deployments").insert({
      source: "manual",
      provider: hookUrl.includes("vercel") ? "vercel" : "lovable",
      status: "queued",
      triggered_by: user.id,
      trigger_reason: reason,
      commit_sha: commitSha ?? null,
      estimated_duration_ms: eta,
      log: `[${now}] QUEUED — Manual redeploy by ${user.email ?? user.id} (reason: ${reason})\n`,
    }).select().single();
    if (error) return jh({ error: error.message }, 500);

    const hookRes = await fetch(hookFinal, { method: "POST" }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as any));
    const respText = await hookRes.text().catch(() => "");
    const ok = (hookRes as Response).ok;

    await supa.from("deployments").update({
      log: `[${now}] QUEUED — Manual redeploy by ${user.email ?? user.id} (reason: ${reason})\n[${new Date().toISOString()}] HOOK ${ok ? "OK" : "FAILED"} (${(hookRes as Response).status}) ${respText.slice(0, 200)}\n`,
      status: ok ? "building" : "error",
      finished_at: ok ? null : new Date().toISOString(),
      meta: { hook_response: respText.slice(0, 500) },
    }).eq("id", inserted.id);

    return jh({ ok: true, id: inserted.id, eta_ms: eta, hook_ok: ok });
  } catch (e) {
    return jh({ error: (e as Error).message }, 500);
  }
});
