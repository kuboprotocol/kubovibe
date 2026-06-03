import { corsHeaders } from "../_shared/cors.ts";

// Bytez exposes models at https://api.bytez.com/models/v2/<model>
// We use a small text model for the ping and accept a `model` override in the body.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  try {
    const key = Deno.env.get("BYTEZ_API_KEY");
    if (!key) throw new Error("BYTEZ_API_KEY not configured");

    let prompt = "Say 'pong' in one word.";
    let model = "Qwen/Qwen3-4B";
    try {
      const body = await req.json();
      if (body?.prompt) prompt = String(body.prompt);
      if (body?.model) model = String(body.model);
    } catch (_) { /* no body */ }

    const r = await fetch(`https://api.bytez.com/models/v2/${model}`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
      },
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
        error: r.ok ? null : data?.error ?? data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        provider: "bytez",
        ok: false,
        latency_ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
