// Image Editor — geração de imagem via Lovable AI Gateway (gemini image preview).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

interface ImgInput {
  prompt?: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  style?: string;
}

Deno.serve((req) =>
  runAgent("image-editor", req, async ({ input }) => {
    const { prompt, size = "1024x1024", style } = input as ImgInput;
    if (!prompt) throw new Error("invalid_prompt");

    const finalPrompt = style ? `${prompt}. Estilo: ${style}.` : prompt;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
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
