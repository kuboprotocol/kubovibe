// Kubo Clips — analisa transcript/descrição de vídeo longo e sugere até 15 cortes com timestamps.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset } from "../_shared/creative.ts";

const COST_PROCESS = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return j(401, { error: "Unauthorized" });

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const { transcript, source_url } = await req.json();
    if (!transcript && !source_url) return j(400, { error: "transcript or source_url required" });

    const ded = await deductCredits(user.id, COST_PROCESS, "creative_clips", { source_url }, user.email, idempotencyKey);
    if (!ded.ok) return j(402, { error: ded.error });

    const DS = Deno.env.get("DEEPSEEK_API_KEY");
    const LK = Deno.env.get("LOVABLE_API_KEY");
    const sys = `Você é editor de vídeo. Analise o texto do vídeo e proponha até 15 cortes virais. Para cada corte retorne JSON com: start (mm:ss), end (mm:ss), title (gancho curto), hook (porquê viraliza). Responda APENAS um array JSON.`;
    const messages = [
      { role: "system", content: sys },
      { role: "user", content: transcript ?? `Vídeo em: ${source_url}` },
    ];

    let raw = "";
    const tries: Array<{ url: string; key?: string; model: string }> = [];
    if (DS) tries.push({ url: "https://api.deepseek.com/chat/completions", key: DS, model: "deepseek-chat" });
    if (LK) tries.push({ url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LK, model: "google/gemini-3-flash-preview" });
    for (const t of tries) {
      const r = await fetch(t.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: t.model, messages, max_tokens: 2000 }),
      });
      if (r.ok) {
        const d = await r.json();
        raw = d?.choices?.[0]?.message?.content ?? "";
        if (raw) break;
      }
    }

    let clips: any[] = [];
    try {
      const m = raw.match(/\[[\s\S]*\]/);
      clips = JSON.parse(m ? m[0] : raw);
    } catch {
      clips = [];
    }

    const assetId = await recordAsset(user.id, {
      tool: "clips",
      prompt: source_url ?? transcript?.slice(0, 200),
      credits_spent: COST_PROCESS,
      metadata: { clips, source_url },
    });

    return j(200, { ok: true, clips, asset_id: assetId });
  } catch (e) {
    return j(500, { error: e instanceof Error ? e.message : "error" });
  }
});

function j(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
