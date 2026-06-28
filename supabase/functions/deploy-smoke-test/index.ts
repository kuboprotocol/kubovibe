// Post-deploy smoke test. Fetches the production URL, parses index.html, and
// validates that every entry script/CSS asset resolves with 200. Fails (and
// optionally triggers rollback) if the deployed shell would render a white
// screen. Public endpoint protected by HMAC (DEPLOY_WEBHOOK_SECRET) so the
// deploy-webhook can call it, plus admin auth for manual runs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-deploy-signature",
};

const SECRET = Deno.env.get("DEPLOY_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyHmac(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

type SmokeResult = {
  ok: boolean;
  url: string;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
};

const REQUIRED_MARKERS: Array<{ name: string; re: RegExp }> = [
  { name: "root mount", re: /<div\s+[^>]*id=["']root["']/i },
  { name: "document title", re: /<title>[^<]+<\/title>/i },
  { name: "viewport meta", re: /<meta\s+name=["']viewport["']/i },
  { name: "entry script", re: /<script[^>]+src=["'][^"']+\.js["']/i },
];

async function smokeTest(targetUrl: string): Promise<SmokeResult> {
  const checks: SmokeResult["checks"] = [];
  let html = "";
  try {
    const res = await fetch(targetUrl, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    checks.push({ name: "index 200", ok: res.ok, detail: `HTTP ${res.status}` });
    html = await res.text();
    checks.push({ name: "html non-empty", ok: html.length > 200, detail: `${html.length} bytes` });
  } catch (e) {
    checks.push({ name: "index fetch", ok: false, detail: (e as Error).message });
    return { ok: false, url: targetUrl, checks };
  }

  for (const m of REQUIRED_MARKERS) {
    checks.push({ name: m.name, ok: m.re.test(html), detail: m.re.test(html) ? "found" : "missing" });
  }

  // Validate each entry script tag resolves
  const scriptSrcs = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)).map(m => m[1]).slice(0, 8);
  const base = new URL(targetUrl);
  for (const src of scriptSrcs) {
    try {
      const abs = new URL(src, base).toString();
      const r = await fetch(abs, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      checks.push({ name: `asset ${src.split("/").pop()}`, ok: r.ok, detail: `HTTP ${r.status}` });
    } catch (e) {
      checks.push({ name: `asset ${src}`, ok: false, detail: (e as Error).message });
    }
  }

  // Reject visibly broken builds
  const errorMarkers = [
    /Application error: a client-side exception has occurred/i,
    /This page could not be found/i,
    /<title>\s*404\s*<\/title>/i,
  ];
  for (const re of errorMarkers) {
    if (re.test(html)) checks.push({ name: "no error page", ok: false, detail: re.source });
  }

  const ok = checks.every(c => c.ok);
  return { ok, url: targetUrl, checks };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const raw = await req.text();
  const sig = req.headers.get("x-deploy-signature");
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  // Auth: HMAC (webhook) OR admin JWT
  let authed = await verifyHmac(raw, sig);
  if (!authed) {
    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (jwt) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
        authed = !!roles?.some((r: any) => r.role === "admin");
      }
    }
  }
  if (!authed) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });

  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch {}
  const deploymentId: string | null = body.deployment_id ?? null;
  const explicitUrl: string | null = body.url ?? null;

  let deployment: any = null;
  if (deploymentId) {
    const { data } = await supa.from("deployments").select("*").eq("id", deploymentId).maybeSingle();
    deployment = data;
  } else {
    const { data } = await supa.from("deployments").select("*").eq("is_current", true).maybeSingle();
    deployment = data;
  }

  const targetUrl = explicitUrl ?? deployment?.url ?? "https://kubovibe.dev";
  const result = await smokeTest(targetUrl);

  if (deployment) {
    const summary = result.checks.map(c => `${c.ok ? "✓" : "✗"} ${c.name} — ${c.detail}`).join("\n");
    const log = (deployment.log || "") + `[${new Date().toISOString()}] SMOKE TEST ${result.ok ? "PASSED" : "FAILED"}\n${summary}\n`;
    await supa.from("deployments").update({
      log,
      healthy: result.ok ? deployment.healthy : false,
      meta: { ...(deployment.meta || {}), last_smoke: { ...result, at: new Date().toISOString() } },
    }).eq("id", deployment.id);

    // Trigger rollback if smoke fails on a currently-live deploy
    if (!result.ok && deployment.is_current) {
      const { data: target } = await supa.from("deployments").select("*")
        .eq("status", "ready").eq("healthy", true).neq("id", deployment.id)
        .not("commit_sha", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
      const hookUrl = Deno.env.get("VERCEL_DEPLOY_HOOK_URL") || Deno.env.get("LOVABLE_DEPLOY_HOOK_URL");
      if (target && hookUrl) {
        const final = `${hookUrl}${hookUrl.includes("?") ? "&" : "?"}sha=${encodeURIComponent(target.commit_sha)}`;
        const r = await fetch(final, { method: "POST" }).catch(() => null);
        await supa.from("deployments").insert({
          source: "auto-rollback",
          provider: hookUrl.includes("vercel") ? "vercel" : "lovable",
          status: r?.ok ? "building" : "error",
          trigger_reason: "Auto-rollback: smoke test failed",
          commit_sha: target.commit_sha,
          commit_message: `[AUTO-ROLLBACK:SMOKE] ${target.commit_message ?? ""}`,
          rolled_back_to: target.id,
          log: `[${new Date().toISOString()}] SMOKE FAIL → rolling back to ${target.commit_sha.slice(0, 7)}\n`,
        });
      }
    }
  }

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 502,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
