// OpusClip — gera sugestões de cortes virais a partir de transcrição/descrição.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

Deno.serve((req) =>
  runAgent("opusclip", req, async ({ input }) => {
    const { transcript, videoTitle, count = 5, language = "pt-BR" } = input as Record<string, string | number>;
    if (!transcript) throw new Error("missing_transcript");
    const n = Math.min(Math.max(Number(count) || 5, 1), 15);

    const sys = `Você é um editor especialista em cortes virais. Analise a transcrição e retorne JSON estrito: { "clips": [{ "title": string, "hook": string, "start_seconds": number, "end_seconds": number, "duration_seconds": number, "virality_score": number, "captions_suggestion": string }] } com ${n} clipes. Idioma: ${language}.`;
    const user = `Título: ${videoTitle ?? "—"}\nTranscrição:\n${transcript}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
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
