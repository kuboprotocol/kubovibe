import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_MODELS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  try {
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

    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) throw new Error("provider_unavailable");

    let prompt = "Say 'pong' in one word.";
    let model = "llama-3.1-8b-instant";
    try {
      const body = await req.json();
      if (typeof body?.prompt === "string") prompt = body.prompt.slice(0, 500);
      if (typeof body?.model === "string" && ALLOWED_MODELS.has(body.model)) model = body.model;
    } catch (_) { /* no body */ }

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 32 }),
    });

    const data = await r.json();
    return new Response(
      JSON.stringify({
        provider: "groq",
        ok: r.ok,
        status: r.status,
        latency_ms: Date.now() - started,
        model: data?.model ?? model,
        reply: data?.choices?.[0]?.message?.content ?? null,
        usage: data?.usage ?? null,
        error: r.ok ? null : "upstream_error",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ping-groq error:", e);
    return new Response(
      JSON.stringify({ provider: "groq", ok: false, latency_ms: Date.now() - started, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
