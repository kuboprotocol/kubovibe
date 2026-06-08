// Kubo Ebook AI — generates a multi-chapter ebook using DeepSeek (primary) + Lovable AI fallback.
// Cover image via Lovable AI Nano Banana.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";

const COST = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return j(401, { error: "Unauthorized" });

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const { topic, chapters = 5, language = "pt-BR" } = await req.json();
    if (!topic) return j(400, { error: "topic required" });

    const ded = await deductCredits(user.id, COST, "creative_ebook", { topic, chapters }, user.email, idempotencyKey);
    if (!ded.ok) return j((ded as any).status ?? 402, { error: ded.error });

    const sys = `Você é um autor profissional. Escreva um eBook em ${language} sobre o tema dado. Gere um título envolvente, um sumário, e ${chapters} capítulos completos, cada um com pelo menos 400 palavras. Use markdown. Comece com # TÍTULO.`;
    const messages = [
      { role: "system", content: sys },
      { role: "user", content: topic },
    ];

    let text = "";
    const DS = Deno.env.get("DEEPSEEK_API_KEY");
    const LK = Deno.env.get("LOVABLE_API_KEY");
    const tries: Array<{ url: string; key?: string; model: string }> = [];
    if (DS) tries.push({ url: "https://api.deepseek.com/chat/completions", key: DS, model: "deepseek-chat" });
    if (LK) tries.push({ url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LK, model: "google/gemini-3-flash-preview" });

    for (const t of tries) {
      const r = await fetch(t.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: t.model, messages, max_tokens: 4000 }),
      });
      if (r.ok) {
        const d = await r.json();
        text = d?.choices?.[0]?.message?.content ?? "";
        if (text) break;
      }
    }
    if (!text) return j(503, { error: "Falha ao gerar conteúdo" });

    // Cover image (best-effort)
    let cover: string | null = null;
    if (LK) {
      try {
        const ir = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LK}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: `Modern minimalist ebook cover for: ${topic}. Premium typography, no text artifacts.` }],
            modalities: ["image", "text"],
          }),
        });
        const id = await ir.json();
        cover = id?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      } catch (_) { /* ignore */ }
    }

    const titleMatch = text.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? topic;

    const assetId = await recordAsset(user.id, {
      tool: "ebook",
      prompt: topic,
      output_text: text,
      output_url: cover ?? undefined,
      credits_spent: COST,
      metadata: { title, chapters, language, cover },
    });

    return j(200, { ok: true, title, content: text, cover, asset_id: assetId });
  } catch (e) {
    console.error("[creative-ebook] error:", e);
    return j(500, { error: sanitizeError(e) });
  }
});

function j(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
