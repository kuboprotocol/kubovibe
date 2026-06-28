// Public beacon endpoint for client-side runtime errors in production.
// Rate-limited (60 req/min/IP) — accepts unauthenticated reports so we can
// catch white-screen errors that occur before auth bootstraps.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_URL = 1024;

function clip(s: unknown, max: number): string | null {
  if (s == null) return null;
  const v = String(s);
  return v.length > max ? v.slice(0, max) : v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }); }

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  // Rate limit: 60/min/IP
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supa.from("runtime_errors")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip).gte("created_at", minuteAgo);
  if ((count ?? 0) >= 60) {
    return new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const severity = ["error", "warn", "fatal"].includes(body.severity) ? body.severity : "error";
  const record = {
    severity,
    message: clip(body.message, MAX_MESSAGE) ?? "(empty)",
    stack: clip(body.stack, MAX_STACK),
    url: clip(body.url, MAX_URL),
    user_agent: clip(req.headers.get("user-agent"), 512),
    release: clip(body.release, 64),
    ip,
    meta: typeof body.meta === "object" && body.meta ? body.meta : {},
  };

  const { error } = await supa.from("runtime_errors").insert(record);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  // If a fatal error arrives within 5min of the current deploy, mark unhealthy
  // so deploy-healthcheck rolls it back on its next pass.
  if (severity === "fatal") {
    const { data: current } = await supa.from("deployments")
      .select("id, finished_at, meta").eq("is_current", true).maybeSingle();
    if (current?.finished_at && (Date.now() - new Date(current.finished_at).getTime()) < 5 * 60_000) {
      await supa.from("deployments").update({
        healthy: false,
        meta: { ...(current.meta || {}), runtime_fatal_at: new Date().toISOString(), runtime_fatal_msg: record.message.slice(0, 200) },
      }).eq("id", current.id);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
