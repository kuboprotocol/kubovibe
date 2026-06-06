// Doc Converter — converte texto entre formatos (markdown, html, plain, json).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

const ALLOWED = ["markdown", "html", "plain", "json", "csv"];

Deno.serve((req) =>
  runAgent("doc-converter", req, async ({ input }) => {
    const { content, from = "markdown", to = "html" } = input as Record<string, string>;
    if (!content) throw new Error("missing_content");
    if (!ALLOWED.includes(from) || !ALLOWED.includes(to)) throw new Error("invalid_format");

    const sys = `Converta o conteúdo de ${from} para ${to}. Retorne APENAS o conteúdo convertido, sem comentários, sem cercas de código.`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content }],
      }),
    });
    if (!r.ok) throw new Error(`ai_${r.status}`);
    const data = await r.json();
    return { output: { from, to, converted: data?.choices?.[0]?.message?.content ?? "" } };
  })
);
