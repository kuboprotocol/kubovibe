// PDF Creator — devolve markdown estruturado pronto para renderização em PDF no cliente.
// O download/render final ocorre no front (mantém edge function leve e sem libs binárias).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

interface PdfInput {
  topic?: string;
  audience?: string;
  style?: "report" | "proposal" | "ebook" | "pitch";
  sections?: number;
  language?: string;
}

const STYLE_PROMPTS: Record<string, string> = {
  report: "Relatório executivo formal, com sumário, dados e conclusões.",
  proposal: "Proposta comercial profissional, com escopo, prazos e investimento.",
  ebook: "E-book didático com capítulos, exemplos e exercícios.",
  pitch: "Pitch deck textual com problema, solução, mercado, tração, time, ask.",
};

Deno.serve((req) =>
  runAgent("pdf-creator", req, async ({ input }) => {
    const { topic, audience = "geral", style = "report", sections = 6, language = "pt-BR" } =
      input as PdfInput;
    if (!topic) throw new Error("invalid_topic");

    const sys = `Você é um redator técnico sênior. Produza um documento ${style} em ${language}.
Estilo: ${STYLE_PROMPTS[style] ?? STYLE_PROMPTS.report}
Público-alvo: ${audience}.
Estruture em exatamente ${Math.min(Math.max(sections, 3), 15)} seções com títulos H1/H2,
listas, callouts e uma conclusão final acionável. Use Markdown puro.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Tema: ${topic}` },
        ],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      // Melhora na saída de erro com detalhamento
      throw new Error(`AI_GATEWAY_FAILURE (Status ${resp.status}): ${txt.slice(0, 256) || "No response body"}`);
    }
    const data = await resp.json();
    const markdown = data?.choices?.[0]?.message?.content ?? "";

    // Regex tolerante para garantir captura de bullets e listas numeradas em listas aninhadas
    const bulletRegex = /^[ \t]*([*+-]|\d+[.)])[ \t]+(.+)$/gm;
    const bullets = [...markdown.matchAll(bulletRegex)].map(m => m[2].trim());

    return {
      output: {
        format: "markdown",
        style,
        language,
        title: topic,
        markdown,
        extracted_bullets: bullets,
        bullet_count: bullets.length,
        render_hint: "client_pdf",
        usage: data?.usage ?? null,
      },
    };
  })
);
