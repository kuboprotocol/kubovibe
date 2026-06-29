// Streaming chat for Kubo Chat.
// Provider chain (in order, first available wins on success):
//   1. Groq (llama-3.3-70b-versatile) — ultra-fast & cheap
//   2. Moonshot direct (if MOONSHOT_API_KEY)
//   3. OpenRouter requested model (if client specified one)
//   4. OpenRouter DeepSeek -> Kimi -> GPT-4o-mini
//   5. Lovable AI Gateway (Gemini) — final fallback
//
// Client may pass `model` to force a specific path. Special prefixes:
//   "groq/<model>"      -> Groq direct
//   "moonshot/<model>"  -> Moonshot direct
//   otherwise           -> OpenRouter
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(10000),
  })).min(1),
  model: z.string().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
});

const COST = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await getUser(req.headers.get("Authorization"));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_input", details: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages, model, temperature, max_tokens } = parsed.data;

    const ded = await deductCredits(user.id, COST, "creative_chat", { count: messages.length }, user.email, idempotencyKey);
    if (!ded.ok) {
      return new Response(JSON.stringify({ error: ded.error }), {
        status: (ded as any).status ?? 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ = Deno.env.get("GROQ_API_KEY");
    const MOONSHOT = Deno.env.get("MOONSHOT_API_KEY");
    const OR = Deno.env.get("OPENROUTER_API_KEY");
    const LK = Deno.env.get("LOVABLE_API_KEY");

    const sys = {
      role: "system" as const,
      content: "Você é o Kubo Chat — assistente direto, claro, em PT-BR. Ajude com conversas, resumos, traduções e geração de textos.",
    };
    const basePayload = { messages: [sys, ...messages], stream: true };

    type Attempt = { name: string; url: string; key: string; model: string };
    const tries: Attempt[] = [];

    // Honor explicit model request first
    if (model?.startsWith("groq/") && GROQ) {
      tries.push({ name: "groq_requested", url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ, model: model.slice(5) });
    } else if (model?.startsWith("moonshot/") && MOONSHOT) {
      tries.push({ name: "moonshot_requested", url: "https://api.moonshot.cn/v1/chat/completions", key: MOONSHOT, model: model.slice(9) });
    } else if (model && OR) {
      tries.push({ name: "openrouter_requested", url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model });
    }

    // Default chain
    if (GROQ) tries.push({ name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ, model: "llama-3.3-70b-versatile" });
    if (MOONSHOT) tries.push({ name: "moonshot", url: "https://api.moonshot.cn/v1/chat/completions", key: MOONSHOT, model: "moonshot-v1-8k" });
    if (OR) {
      tries.push({ name: "openrouter_deepseek", url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model: "deepseek/deepseek-chat" });
      tries.push({ name: "openrouter_kimi", url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model: "moonshotai/kimi-k2.6" });
      tries.push({ name: "openrouter_gpt4o_mini", url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model: "openai/gpt-4o-mini" });
    }
    if (LK) tries.push({ name: "lovable_gemini", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LK, model: "google/gemini-2.0-flash-exp" });

    for (const t of tries) {
      try {
        const r = await fetch(t.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...basePayload,
            model: t.model,
            temperature: temperature ?? 0.7,
            max_tokens: max_tokens ?? 2000,
          }),
        });
        if (r.ok && r.body) {
          recordAsset(user.id, {
            tool: "chat",
            prompt: String(messages[messages.length - 1]?.content ?? "").slice(0, 1000),
            credits_spent: COST,
            metadata: { provider: t.name, model: t.model },
          }).catch(() => {});
          return new Response(r.body, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "X-Provider": t.name,
              "X-Model": t.model,
            },
          });
        }
        console.warn(`[creative-chat] provider ${t.name} failed: ${r.status}`);
      } catch (e) {
        console.warn(`[creative-chat] provider ${t.name} threw:`, e);
      }
    }

    return new Response(JSON.stringify({ error: "Nenhum provedor de IA disponível" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[creative-chat] error:", e);
    return new Response(JSON.stringify({ error: sanitizeError(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
