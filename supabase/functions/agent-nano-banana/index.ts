// Nano Banana — gerador rápido de conteúdo (legendas, posts, ideias).
// Usa Lovable AI Gateway (gemini-flash) — ultra barato, ultra rápido.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  prompt: z.string().min(1).max(5000),
  format: z.enum(["caption", "post", "ideas", "tagline"]).optional().default("post"),
  count: z.number().int().min(1).max(20).optional().default(5),
  language: z.string().max(20).optional().default("pt-BR"),
});

const FORMAT_PROMPTS: Record<string, string> = {
...
};

Deno.serve((req) =>
  runAgent("nano-banana", req, async ({ input }) => {
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`invalid_input: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    const { prompt, format, count, language } = parsed.data;
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
