import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1),
  })).optional(),
  prompt: z.string().optional(),
  tool: z.enum(["chat", "image", "video", "music", "pdf", "docs", "slide", "edit_image", "edit_video"]),
  model: z.string().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

// Credit costs based on prompt instructions
const COSTS: Record<string, number> = {
  chat: 1,      // Message simple (Featherless) or premium light
  chat_premium: 4, // Message premium frontier (Claude Sonnet)
  image: 1,     // Pollinations / Nano Banana
  video: 36,    // MusKAI / Sogni (est.)
  music: 1,     // MusKAI / Suno
  slide: 5,     // Content + Template
  pdf: 0,       // Local Utility
  docs: 0,      // Local Utility
  edit_image: 0, // Local Utility
  edit_video: 0, // Local Utility
};

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

    const { tool, messages, prompt, model, temperature, max_tokens, metadata } = parsed.data;
    
    // Determine cost
    let cost = COSTS[tool] ?? 1;
    if (tool === "chat" && model?.includes("sonnet")) {
      cost = COSTS.chat_premium;
    }

    // Deduct credits
    const ded = await deductCredits(user.id, cost, `creative_${tool}`, metadata ?? {}, user.email, idempotencyKey);
    if (!ded.ok) {
      return new Response(JSON.stringify({ error: ded.error }), {
        status: (ded as any).status ?? 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route based on tool
    if (tool === "chat") {
      return await handleChat(user.id, messages ?? [], model, temperature, max_tokens, cost);
    } else if (tool === "image") {
      return await handleImage(user.id, prompt ?? "", metadata, cost);
    }

    return new Response(JSON.stringify({ error: "tool_not_implemented_in_router" }), {
      status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[creative-router] error:", e);
    return new Response(JSON.stringify({ error: sanitizeError(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleChat(userId: string, messages: any[], requestedModel?: string, temperature?: number, max_tokens?: number, cost?: number) {
  const FEATHERLESS_KEY = Deno.env.get("FEATHERLESS_API_KEY");
  const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY");
  
  const sys = {
    role: "system",
    content: "Você é o assistente KUBO Vibe. Seja direto, técnico e profissional. Idioma: Português Brasileiro.",
  };
  const payload = {
    messages: [sys, ...messages],
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 1500, // Hard limit from prompt
    stream: true,
  };

  // Tier 1: Featherless (Fixed Cost) - Default for simple tasks or Free users
  // Tier 2: OpenRouter (Frontier) - For complex tasks or requested frontier models
  
  const isFrontierRequested = requestedModel?.includes("sonnet") || requestedModel?.includes("gpt-4o");
  
  if (!isFrontierRequested && FEATHERLESS_KEY) {
    try {
      const resp = await fetchWithRetry("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FEATHERLESS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          model: requestedModel ?? "meta-llama/llama-3.1-70b-instruct",
        }),
      });

      if (resp.ok && resp.body) {
        recordAsset(userId, {
          tool: "chat",
          prompt: messages[messages.length - 1]?.content?.slice(0, 1000),
          credits_spent: cost ?? 1,
          metadata: { engine: "featherless", model: requestedModel ?? "llama-3.1-70b" },
        }).catch(console.error);
        
        return new Response(resp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Engine": "featherless" },
        });
      }
      console.warn("[creative-router] Featherless failed, falling back to OpenRouter");
    } catch (e) {
      console.error("[creative-router] Featherless error:", e);
    }
  }

  // Fallback or explicit Frontier
  if (OPENROUTER_KEY) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kubovibe.dev",
        "X-Title": "KUBO Vibe",
      },
      body: JSON.stringify({
        ...payload,
        model: requestedModel ?? "openai/gpt-4o-mini",
      }),
    });

    if (resp.ok && resp.body) {
      recordAsset(userId, {
        tool: "chat",
        prompt: messages[messages.length - 1]?.content?.slice(0, 1000),
        credits_spent: cost ?? 1,
        metadata: { engine: "openrouter", model: requestedModel ?? "gpt-4o-mini" },
      }).catch(console.error);
      
      return new Response(resp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Engine": "openrouter" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Nenhum motor de IA disponível" }), {
    status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleImage(userId: string, prompt: string, metadata?: any, cost?: number) {
  // Image logic: Pollinations (Free/Fixed-ish) or Nano Banana (via Lovable/Gemini)
  // Prompt says: Pollinations for imagen (free/flat)
  const engine = metadata?.engine === "premium" ? "lovable" : "pollinations";
  
  if (engine === "pollinations") {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    
    await recordAsset(userId, {
      tool: "image",
      prompt,
      output_url: imageUrl,
      credits_spent: cost ?? 1,
      metadata: { engine: "pollinations" },
    }).catch(console.error);

    return new Response(JSON.stringify({ ok: true, image_url: imageUrl, engine: "pollinations" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Lovable/Gemini Premium path
  const LK = Deno.env.get("LOVABLE_API_KEY");
  if (!LK) return new Response(JSON.stringify({ error: "premium_image_provider_unavailable" }), { status: 503, headers: corsHeaders });

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  const data = await r.json();
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (imageUrl) {
    await recordAsset(userId, {
      tool: "image",
      prompt,
      output_url: imageUrl,
      credits_spent: cost ?? 1,
      metadata: { engine: "lovable_gemini" },
    }).catch(console.error);

    return new Response(JSON.stringify({ ok: true, image_url: imageUrl, engine: "lovable" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "image_generation_failed" }), { status: 502, headers: corsHeaders });
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    const resp = await fetch(url, options);
    if (resp.status !== 429) return resp;
    
    // Concurrency limit reached - wait a bit and retry
    attempt++;
    const wait = Math.pow(2, attempt) * 1000;
    console.warn(`[creative-router] 429 received, retrying in ${wait}ms...`);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  return await fetch(url, options);
}
