import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  try {
    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) throw new Error("GROQ_API_KEY not configured");

    let prompt = "Say 'pong' in one word.";
    let model = "llama-3.1-8b-instant";
    try {
      const body = await req.json();
      if (body?.prompt) prompt = String(body.prompt);
      if (body?.model) model = String(body.model);
    } catch (_) { /* no body */ }

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 32,
      }),
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
        error: r.ok ? null : data?.error ?? data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        provider: "groq",
        ok: false,
        latency_ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
