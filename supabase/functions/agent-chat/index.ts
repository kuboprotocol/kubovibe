// Chat Inteligente — conversação multi-turno via OpenRouter Kimi (moonshotai/kimi-k2)
// com fallback Groq → DeepSeek → Lovable Gemini.
import { runAgent } from "../_shared/agentRuntime.ts";
import { callLlm } from "../_shared/llm.ts";
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

    const { content, provider, model, usage } = await callLlm({
      prefer: "kimi",
      messages: msgs,
    });
    return { output: { reply: content, provider, model, usage } };
  })
);
