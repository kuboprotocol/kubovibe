// Chat Inteligente — conversação multi-turno via Gemini Flash.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

interface Msg { role: "system" | "user" | "assistant"; content: string }

Deno.serve((req) =>
  runAgent("chat-agent", req, async ({ input }) => {
    const { messages, prompt, system, language = "pt-BR" } = input as {
      messages?: Msg[]; prompt?: string; system?: string; language?: string;
    };
    const msgs: Msg[] = [];
    msgs.push({
      role: "system",
      content: system ?? `Você é o KUBO Chat, assistente útil e direto. Responda em ${language}.`,
    });
    if (messages?.length) msgs.push(...messages);
    if (prompt) msgs.push({ role: "user", content: prompt });
    if (msgs.length < 2) throw new Error("missing_prompt_or_messages");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: msgs }),
    });
    if (!r.ok) throw new Error(`ai_${r.status}:${(await r.text()).slice(0,200)}`);
    const data = await r.json();
    return { output: { reply: data?.choices?.[0]?.message?.content ?? "", usage: data?.usage ?? null } };
  })
);
