import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_MODELS = new Set(["Qwen/Qwen3-4B", "Qwen/Qwen2.5-7B-Instruct"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  try {
    // Require authenticated caller
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("BYTEZ_API_KEY");
    if (!key) throw new Error("provider_unavailable");

    let prompt = "Say 'pong' in one word.";
    let model = "Qwen/Qwen3-4B";
    try {
      const body = await req.json();
      if (typeof body?.prompt === "string") prompt = body.prompt.slice(0, 500);
      if (typeof body?.model === "string" && ALLOWED_MODELS.has(body.model)) model = body.model;
    } catch (_) { /* no body */ }

    const r = await fetch(`https://api.bytez.com/models/v2/${model}`, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
    });

    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(
      JSON.stringify({
        provider: "bytez",
        ok: r.ok,
        status: r.status,
        latency_ms: Date.now() - started,
        model,
        reply: data?.output ?? data?.result ?? data?.data ?? null,
        error: r.ok ? null : "upstream_error",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ping-bytez error:", e);
    return new Response(
      JSON.stringify({ provider: "bytez", ok: false, latency_ms: Date.now() - started, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
