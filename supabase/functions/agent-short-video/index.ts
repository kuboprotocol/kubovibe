// Short Video Creator — roteiriza vídeo curto 30s/60s (cena, narração, b-roll).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

Deno.serve((req) =>
  runAgent("short-video", req, async ({ input }) => {
    const { prompt, duration = 30, platform = "shorts", language = "pt-BR" } =
      input as Record<string, string | number>;
    if (!prompt) throw new Error("missing_prompt");
    const d = [15, 30, 60].includes(Number(duration)) ? Number(duration) : 30;

    const sys = `Você é roteirista de vídeos curtos virais para ${platform}. Retorne JSON estrito: { "title": string, "hook": string, "duration_seconds": number, "scenes": [{ "index": number, "duration_s": number, "voiceover": string, "on_screen_text": string, "b_roll": string, "camera": string }], "cta": string, "hashtags": string[] }. Idioma: ${language}. Duração total: ${d}s.`;
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
    return { output: parsed };
  })
);
