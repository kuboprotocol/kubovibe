// Avatar Speaker — gera roteiro otimizado para avatares falantes
// (HeyGen/D-ID/ElevenLabs). MVP entrega script + cues; integração de render é opt-in.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  prompt: z.string().min(1).max(5000),
  persona: z.string().max(100).optional().default("host profissional"),
  duration: z.number().int().min(1).max(3600).optional().default(60),
  language: z.string().max(20).optional().default("pt-BR"),
});

Deno.serve((req) =>
  runAgent("avatar-speaker", req, async ({ input }) => {
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`invalid_input: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    const { prompt, persona, duration, language } = parsed.data;
    if (!prompt) throw new Error("missing_prompt");

    const sys = `Você escreve roteiros para avatares falantes IA. Retorne JSON estrito: { "title": string, "persona": string, "duration_seconds": number, "scenes": [{ "text": string, "pause_after_ms": number, "emphasis_words": string[] }], "ssml": string }. Idioma: ${language}. Persona: ${persona}. Duração-alvo: ${duration}s.`;
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
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch { /* */ }
    return {
      output: {
        script: parsed,
        render_provider: null,
        note: "Script + SSML pronto. Conecte HeyGen/D-ID para render final.",
      },
    };
  })
);
