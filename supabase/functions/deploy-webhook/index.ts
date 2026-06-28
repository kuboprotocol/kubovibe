// Public webhook endpoint for build/deploy status updates (Vercel/Lovable/GitHub).
// HMAC-SHA256 signed using DEPLOY_WEBHOOK_SECRET in `x-deploy-signature` header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-deploy-signature, x-vercel-signature",
};

const SECRET = Deno.env.get("DEPLOY_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyHmac(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

type Payload = {
  external_id?: string;
  provider?: string;
  status: "queued" | "building" | "deploying" | "ready" | "error" | "canceled";
  commit_sha?: string;
  commit_message?: string;
  branch?: string;
  url?: string;
  log_append?: string;
  meta?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const body = await req.text();
  const sig = req.headers.get("x-deploy-signature") ?? req.headers.get("x-vercel-signature");
  if (!await verifyHmac(body, sig)) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  let payload: Payload;
  try { payload = JSON.parse(body); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }); }

  if (!payload.status) {
    return new Response(JSON.stringify({ error: "missing status" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find existing deployment by external_id, else create
  let deployment: any = null;
  if (payload.external_id) {
    const { data } = await supa.from("deployments").select("*").eq("external_id", payload.external_id).maybeSingle();
    deployment = data;
  }

  // ETA: rolling average of last 10 successful prod deploys
  let estimated_duration_ms: number | null = null;
  if (!deployment) {
    const { data: hist } = await supa.from("deployments")
      .select("duration_ms").eq("status", "ready").eq("environment", "production")
      .not("duration_ms", "is", null).order("started_at", { ascending: false }).limit(10);
    if (hist && hist.length) {
      estimated_duration_ms = Math.round(hist.reduce((s: number, r: any) => s + (r.duration_ms || 0), 0) / hist.length);
    }
  }

  const now = new Date().toISOString();
  const isTerminal = ["ready", "error", "canceled"].includes(payload.status);
  const logLine = `[${now}] ${payload.status.toUpperCase()}${payload.log_append ? ` — ${payload.log_append}` : ""}\n`;

  if (deployment) {
    const duration_ms = isTerminal && deployment.started_at
      ? Date.now() - new Date(deployment.started_at).getTime() : deployment.duration_ms;
    const updates: any = {
      status: payload.status,
      log: (deployment.log || "") + logLine,
      finished_at: isTerminal ? now : null,
      duration_ms,
      url: payload.url ?? deployment.url,
      commit_sha: payload.commit_sha ?? deployment.commit_sha,
      commit_message: payload.commit_message ?? deployment.commit_message,
      branch: payload.branch ?? deployment.branch,
      meta: { ...(deployment.meta || {}), ...(payload.meta || {}) },
    };
    await supa.from("deployments").update(updates).eq("id", deployment.id);

    if (payload.status === "ready") {
      // Mark as current; clear flag from others in same env
      await supa.from("deployments").update({ is_current: false }).eq("environment", deployment.environment).neq("id", deployment.id);
      await supa.from("deployments").update({ is_current: true, healthy: true }).eq("id", deployment.id);

      // Fire post-deploy smoke test (fire-and-forget; the smoke function
      // updates the deployment row + triggers rollback on failure).
      try {
        const smokeBody = JSON.stringify({ deployment_id: deployment.id, url: payload.url ?? deployment.url });
        const key = await crypto.subtle.importKey(
          "raw", new TextEncoder().encode(SECRET),
          { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
        );
        const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(smokeBody));
        const smokeSig = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
        fetch(`${SUPABASE_URL}/functions/v1/deploy-smoke-test`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-deploy-signature": smokeSig },
          body: smokeBody,
        }).catch(() => {});
      } catch (_) { /* never block webhook */ }
    }
  } else {
    const { data: inserted } = await supa.from("deployments").insert({
      source: "webhook",
      provider: payload.provider ?? null,
      external_id: payload.external_id ?? null,
      status: payload.status,
      commit_sha: payload.commit_sha ?? null,
      commit_message: payload.commit_message ?? null,
      branch: payload.branch ?? null,
      url: payload.url ?? null,
      log: logLine,
      estimated_duration_ms,
      meta: payload.meta ?? {},
    }).select().single();
    deployment = inserted;
  }

  return new Response(JSON.stringify({ ok: true, id: deployment?.id }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
