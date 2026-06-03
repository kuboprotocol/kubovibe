import { corsHeaders } from "../_shared/cors.ts";

// Suno API (sunoapi.org compatible). Ping = call /api/v1/get-credits (lightweight, non-billable).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  try {
    const key = Deno.env.get("SUNO_API_KEY");
    if (!key) throw new Error("SUNO_API_KEY not configured");

    const base = Deno.env.get("SUNO_API_BASE") ?? "https://apibox.erweima.ai";
    const r = await fetch(`${base}/api/v1/generate/credit`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(
      JSON.stringify({
        provider: "suno",
        ok: r.ok,
        status: r.status,
        latency_ms: Date.now() - started,
        credits: data?.data ?? data?.credits ?? null,
        message: data?.msg ?? data?.message ?? null,
        error: r.ok ? null : data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        provider: "suno",
        ok: false,
        latency_ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
