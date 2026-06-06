// Nano Banana — gerador rápido de conteúdo (legendas, posts, ideias).
// Usa Lovable AI Gateway (gemini-flash) — ultra barato, ultra rápido.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

interface NanoInput {
  prompt?: string;
  format?: "caption" | "post" | "ideas" | "tagline";
  count?: number;
  language?: string;
}

const FORMAT_PROMPTS: Record<string, string> = {
  caption: "Gere legendas curtas e impactantes para redes sociais.",
  post: "Gere posts completos prontos para publicar (até 280 caracteres).",
  ideas: "Gere ideias de conteúdo numeradas, criativas e acionáveis.",
  tagline: "Gere taglines memoráveis e curtas (máx. 8 palavras).",
};

Deno.serve((req) =>
  runAgent("nano-banana", req, async ({ input }) => {
    const { prompt, format = "post", count = 5, language = "pt-BR" } =
      input as NanoInput;
    if (!prompt || typeof prompt !== "string") {
      throw new Error("invalid_prompt");
    }

    const sys =
      `${FORMAT_PROMPTS[format] ?? FORMAT_PROMPTS.post} Responda em ${language}. Gere exatamente ${Math.min(Math.max(count, 1), 20)} variações.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`ai_gateway_${resp.status}:${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return {
      output: {
        format,
        language,
        text: content,
        usage: data?.usage ?? null,
      },
    };
  })
);
