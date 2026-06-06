// Docs Creator — gera documentos Markdown estruturados (relatórios, propostas).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

Deno.serve((req) =>
  runAgent("docs-creator", req, async ({ input }) => {
    const { prompt, docType = "report", language = "pt-BR" } = input as Record<string, string>;
    if (!prompt) throw new Error("missing_prompt");

    const sys = `Você é um redator técnico. Gere um documento ${docType} em Markdown bem estruturado (títulos, subtítulos, listas, tabelas quando útil). Idioma: ${language}.`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      }),
    });
    if (!r.ok) throw new Error(`ai_${r.status}`);
    const data = await r.json();
    const markdown = data?.choices?.[0]?.message?.content ?? "";
    return { output: { doc_type: docType, language, markdown, word_count: markdown.split(/\s+/).length } };
  })
);
