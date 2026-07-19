// Nano Banana Agent (texto) — gerador rápido de conteúdo (legendas, posts, ideias).
// Roteia via OpenRouter Kimi (moonshotai/kimi-k2) com fallback Groq → Lovable Gemini.
// (A geração de imagem "Nano Banana" continua em `creative-image`, via Lovable Gemini.)
import { runAgent } from "../_shared/agentRuntime.ts";
import { callLlm } from "../_shared/llm.ts";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  prompt: z.string().min(1).max(5000),
  format: z.enum(["caption", "post", "ideas", "tagline"]).optional().default("post"),
  count: z.number().int().min(1).max(20).optional().default(5),
  language: z.string().max(20).optional().default("pt-BR"),
});

const FORMAT_PROMPTS: Record<string, string> = {
  caption: "Gere legendas curtas e engajadoras para redes sociais.",
  post: "Gere posts informativos e interessantes.",
  ideas: "Gere ideias criativas sobre o tema.",
  tagline: "Gere frases de impacto curtas.",
};

Deno.serve((req) =>
  runAgent("nano-banana", req, async ({ input }) => {
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`invalid_input: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    const { prompt, format, count, language } = parsed.data;

    const sys =
      `${FORMAT_PROMPTS[format] ?? FORMAT_PROMPTS.post} Responda em ${language}. Gere exatamente ${Math.min(Math.max(count, 1), 20)} variações.`;

    const { content, provider, model, usage } = await callLlm({
      prefer: "kimi",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
    });

    return { output: { format, language, text: content, provider, model, usage } };
  })
);
