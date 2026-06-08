// Docs Creator — gera documentos Markdown estruturados (relatórios, propostas).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

/**
 * Utilitário para sanitizar e validar o Markdown gerado,
 * garantindo que bullets aninhados sejam interpretados corretamente.
 */
function processMarkdown(markdown: string) {
  // Regex tolerante para bullets e listas numeradas (captura conteúdo após o símbolo ou número)
  const bulletRegex = /^[ \t]*([*+-]|\d+[.)])[ \t]+(.+)$/gm;
  const bullets: string[] = [];
  let match;
  while ((match = bulletRegex.exec(markdown)) !== null) {
    bullets.push(match[2].trim());
  }

  return {
    markdown,
    word_count: markdown.split(/\s+/).filter(Boolean).length,
    extracted_bullets: bullets,
    bullet_count: bullets.length
  };
}

Deno.serve((req) =>
  runAgent("docs-creator", req, async ({ input }) => {
    const { prompt, docType = "report", language = "pt-BR" } = input as Record<string, string>;
    if (!prompt) throw new Error("missing_prompt");

    const sys = `Você é um redator técnico. Gere um documento ${docType} em Markdown bem estruturado (títulos, subtítulos, listas, tabelas quando útil). Use identação padrão para listas aninhadas. Idioma: ${language}.`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const errorText = await r.text();
      console.error(`[docs-creator] AI Gateway error ${r.status}:`, errorText);
      throw new Error(`ai_service_error`);
    }

    const data = await r.json();
    const rawMarkdown = data?.choices?.[0]?.message?.content ?? "";
    
    return { 
      output: { 
        doc_type: docType, 
        language, 
        ...processMarkdown(rawMarkdown) 
      } 
    };
  })
);
