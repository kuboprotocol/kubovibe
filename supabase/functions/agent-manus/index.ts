// Manus — automação multi-step: decompõe tarefa em plano + executa pesquisa textual.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

Deno.serve((req) =>
  runAgent("manus", req, async ({ input }) => {
    const { task, depth = "standard", language = "pt-BR" } = input as Record<string, string>;
    if (!task) throw new Error("missing_task");

    const sys = `Você é o KUBO Manus, agente de automação. Decomponha a tarefa em plano executável e produza o entregável final. Retorne JSON estrito: { "plan": [{ "step": number, "action": string, "rationale": string }], "deliverable": string, "next_actions": string[], "confidence": number }. Profundidade: ${depth}. Idioma: ${language}.`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: depth === "deep" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: task }],
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
