// Streaming chat for Kubo Chat. Primary: OpenRouter (gpt-4o-mini), Fallback: Lovable AI.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(5000),
  })).min(1),
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
    const { messages } = parsed.data;

    const ded = await deductCredits(user.id, COST, "creative_chat", { count: messages.length }, user.email, idempotencyKey);
    if (!ded.ok) {
      return new Response(JSON.stringify({ error: ded.error }), {
        status: (ded as any).status ?? 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OR = Deno.env.get("OPENROUTER_API_KEY");
    const LK = Deno.env.get("LOVABLE_API_KEY");

    const sys = {
      role: "system",
      content: "Você é o Kubo Chat — assistente direto, claro, em PT-BR. Ajude com conversas, resumos, traduções e geração de textos.",
    };
    const payload = { messages: [sys, ...messages], stream: true };

    const tries: Array<{ name: string; url: string; key?: string; model: string }> = [];
    if (OR) tries.push({ name: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model: "openai/gpt-4o-mini" });
    if (LK) tries.push({ name: "lovable", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LK, model: "google/gemini-3-flash-preview" });

    for (const t of tries) {
      const r = await fetch(t.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, model: t.model }),
      });
      if (r.ok) {
        // Record asset (best-effort, fire-and-forget)
        recordAsset(user.id, {
          tool: "chat",
          prompt: String(messages[messages.length - 1]?.content ?? "").slice(0, 1000),
          credits_spent: COST,
          metadata: { provider: t.name, model: t.model },
        }).catch(() => {});
        return new Response(r.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }
    return new Response(JSON.stringify({ error: "Nenhum provedor de IA disponível" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
