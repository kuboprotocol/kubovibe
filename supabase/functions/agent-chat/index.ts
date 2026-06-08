// Chat Inteligente — conversação multi-turno via Gemini Flash.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";
import { z } from "npm:zod@3";

const MsgSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(10000),
});

const InputSchema = z.object({
  messages: z.array(MsgSchema).optional(),
  prompt: z.string().min(1).max(5000).optional(),
  system: z.string().max(5000).optional(),
  language: z.string().max(20).optional(),
});

interface Msg { role: "system" | "user" | "assistant"; content: string }

Deno.serve((req) =>
  runAgent("chat-agent", req, async ({ input }) => {
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`invalid_input: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }

    const { messages, prompt, system, language = "pt-BR" } = parsed.data;
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
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`[agent-chat] AI Gateway error ${r.status}:`, errorText);
      throw new Error(`ai_service_error`);
    }
    const data = await r.json();
    return { output: { reply: data?.choices?.[0]?.message?.content ?? "", usage: data?.usage ?? null } };
  })
);
