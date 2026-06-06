// Creative Panel — briefing criativo estruturado (campanha, narrativa, mood).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

Deno.serve((req) =>
  runAgent("creative-panel", req, async ({ input }) => {
    const { prompt, brand, audience, channel, language = "pt-BR" } = input as Record<string, string>;
    if (!prompt) throw new Error("missing_prompt");

    const sys = `Você é um diretor criativo sênior. Gere um briefing estruturado em JSON estrito com campos: { "concept": string, "tagline": string, "tone": string, "audience": string, "channels": string[], "visual_direction": string, "key_messages": string[], "deliverables": string[] }. Idioma: ${language}.`;
    const user = `Brief do usuário: ${prompt}\nMarca: ${brand ?? "—"}\nAudiência: ${audience ?? "—"}\nCanal: ${channel ?? "—"}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`ai_${r.status}`);
    const data = await r.json();
    let parsed: unknown = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch { /* ignore */ }
    return { output: { brief: parsed, raw: data?.choices?.[0]?.message?.content } };
  })
);
