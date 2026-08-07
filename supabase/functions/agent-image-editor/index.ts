// Image Editor — geração de imagem via Lovable AI Gateway (gemini image preview).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  prompt: z.string().min(1).max(5000),
  size: z.enum(["1024x1024", "1024x1792", "1792x1024"]).optional().default("1024x1024"),
  style: z.string().max(100).optional(),
});

Deno.serve((req) =>
  runAgent("image-editor", req, async ({ input }) => {
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`invalid_input: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    const { prompt, size, style } = parsed.data;
    if (!prompt) throw new Error("invalid_prompt");

    const finalPrompt = style ? `${prompt}. Estilo: ${style}.` : prompt;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp",
        messages: [{ role: "user", content: finalPrompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`ai_gateway_${resp.status}:${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    const images = data?.choices?.[0]?.message?.images ?? [];
    const imageUrl = images?.[0]?.image_url?.url ?? null;
    if (!imageUrl) throw new Error("no_image_returned");

    return {
      output: {
        prompt: finalPrompt,
        size,
        image_url: imageUrl,
        usage: data?.usage ?? null,
      },
    };
  })
);
