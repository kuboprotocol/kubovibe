// Avatar Speaker — gera roteiro otimizado para avatares falantes
// (HeyGen/D-ID/ElevenLabs). MVP entrega script + cues; integração de render é opt-in.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

Deno.serve((req) =>
  runAgent("avatar-speaker", req, async ({ input }) => {
    const { prompt, persona = "host profissional", duration = 60, language = "pt-BR" } =
      input as Record<string, string | number>;
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
