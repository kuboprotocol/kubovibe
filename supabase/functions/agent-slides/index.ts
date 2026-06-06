// Slides Generator — apresentações em JSON (título, bullets, notas).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

Deno.serve((req) =>
  runAgent("slides", req, async ({ input }) => {
    const { prompt, slideCount = 8, language = "pt-BR", style = "executive" } = input as Record<string, string | number>;
    if (!prompt) throw new Error("missing_prompt");
    const n = Math.min(Math.max(Number(slideCount) || 8, 3), 30);

    const sys = `Você gera apresentações profissionais. Retorne JSON estrito: { "title": string, "subtitle": string, "slides": [{ "title": string, "bullets": string[], "notes": string }] } com exatamente ${n} slides. Estilo: ${style}. Idioma: ${language}.`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: sys }, { role: "user", content: String(prompt) }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`ai_${r.status}`);
    const data = await r.json();
    let deck: Record<string, unknown> = {};
    try { deck = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch { /* */ }
    return { output: { deck, slide_count: n } };
  })
);
