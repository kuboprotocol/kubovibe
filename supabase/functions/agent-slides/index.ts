// Slides Generator — apresentações em JSON (título, bullets, notas).
// Roteado via OpenRouter Kimi (moonshotai/kimi-k2) com fallback Lovable Gemini.
import { runAgent } from "../_shared/agentRuntime.ts";
import { callLlm } from "../_shared/llm.ts";

Deno.serve((req) =>
  runAgent("slides", req, async ({ input }) => {
    const { prompt, slideCount = 8, language = "pt-BR", style = "executive" } = input as Record<string, string | number>;
    if (!prompt) throw new Error("missing_prompt");
    const n = Math.min(Math.max(Number(slideCount) || 8, 3), 30);

    const sys = `Você gera apresentações profissionais. Retorne JSON estrito: { "title": string, "subtitle": string, "slides": [{ "title": string, "bullets": string[], "notes": string }] } com exatamente ${n} slides. Estilo: ${style}. Idioma: ${language}.`;

    const { content, provider, model, usage } = await callLlm({
      prefer: "kimi",
      json: true,
      max_tokens: 4000,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: String(prompt) },
      ],
    });

    let deck: Record<string, unknown> = {};
    try { deck = JSON.parse(content || "{}"); } catch { /* invalid json — leave empty */ }
    return { output: { deck, slide_count: n, provider, model, usage } };
  })
);
