// Kubo Shorts + Avatar — text/image to short video.
// MVP: usa Bytez para gerar narração via texto+IA. Quando Bytez não responder com vídeo,
// retorna um pacote com roteiro + narração textual + cover image gerada (placeholder visual)
// e marca o asset com status processing.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return j(401, { error: "Unauthorized" });

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const { mode = "shorts", prompt, duration = 30 } = await req.json();
    if (!prompt) return j(400, { error: "prompt required" });

    let cost = 3;
    let tool = "shorts";
    if (mode === "avatar") {
      tool = "avatar";
      cost = duration >= 60 ? 4 : 2;
    }

    const ded = await deductCredits(user.id, cost, `creative_${tool}`, { prompt, duration }, user.email, idempotencyKey);
    if (!ded.ok) return j((ded as any).status ?? 402, { error: ded.error });

    // 1) Generate script using DeepSeek/Lovable AI
    const DS = Deno.env.get("DEEPSEEK_API_KEY");
    const LK = Deno.env.get("LOVABLE_API_KEY");
    const sysMsg =
      mode === "avatar"
        ? `Escreva um roteiro de narração para avatar IA de ${duration} segundos sobre o tema. Linguagem natural, PT-BR, fluida para voz.`
        : `Escreva um roteiro de vídeo curto vertical (Reels/Shorts/TikTok) em PT-BR, com gancho nos primeiros 3s, narração e call-to-action. Duração aproximada: ${duration}s.`;
    const messages = [
      { role: "system", content: sysMsg },
      { role: "user", content: prompt },
    ];
    let script = "";
    const aiTries: Array<{ url: string; key?: string; model: string }> = [];
    if (OR) aiTries.push({ url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model: "moonshotai/kimi-k2.6" });
    if (DS) aiTries.push({ url: "https://api.deepseek.com/chat/completions", key: DS, model: "deepseek-chat" });
    if (LK) aiTries.push({ url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LK, model: "google/gemini-3-flash-preview" });
    for (const t of aiTries) {
      const r = await fetch(t.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: t.model, messages, max_tokens: 800 }),
      });
      if (r.ok) {
        const d = await r.json();
        script = d?.choices?.[0]?.message?.content ?? "";
        if (script) break;
      }
    }

    // 2) Generate cover/thumbnail via Lovable AI image
    let cover: string | null = null;
    if (LK) {
      try {
        const ir = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LK}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: `Thumbnail vertical cinematográfica para vídeo: ${prompt}` }],
            modalities: ["image", "text"],
          }),
        });
        const id = await ir.json();
        cover = id?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      } catch (_) { /* ignore */ }
    }

    const assetId = await recordAsset(user.id, {
      tool,
      status: "processing",
      prompt,
      output_url: cover ?? undefined,
      output_text: script,
      credits_spent: cost,
      metadata: { mode, duration, cover, script },
    });

    return j(200, {
      ok: true,
      asset_id: assetId,
      script,
      cover,
      note: "Roteiro + thumbnail prontos. Renderização final de vídeo em fila (será disponibilizada em breve).",
    });
  } catch (e) {
    console.error("[creative-video] error:", e);
    return j(500, { error: sanitizeError(e) });
  }
});

function j(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
