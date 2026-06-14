import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- KUBO FLOW AI System Prompts ---

const FLOW_PROMPT = `You are KUBO FLOW AI in ⚡ FLOW mode — maximum speed code generation.

Rules:
- Output ONLY the HTML code. No explanations, no markdown fences.
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Generate code INSTANTLY. Zero explanations. Pure output.
- Modern, clean UI with glass effects, gradients, and micro-interactions.
- Responsive and visually polished.
- Include inline JavaScript for interactivity.
- Use emoji or SVG icons, no external icon libraries.
- Start with <!DOCTYPE html> and end with </html>.
- Focus: SPEED + VISUAL IMPACT.`;

const THINK_PROMPT = `You are KUBO FLOW AI in 🧠 THINK mode — strategic analysis before generation.

Rules:
- First, briefly analyze the request (2-3 lines max): architecture, approach, key decisions.
- Then generate the complete HTML code.
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Think like a senior architect: scalable patterns, clean structure, best practices.
- Modern UI with thoughtful UX decisions.
- Responsive and accessible.
- Include inline JavaScript for interactivity.
- Use emoji or SVG icons, no external icon libraries.
- Start code with <!DOCTYPE html> and end with </html>.
- Focus: STRATEGY + QUALITY.`;

const SHIP_PROMPT = `You are KUBO FLOW AI in 🚀 SHIP mode — production-grade code generation.

Rules:
- Generate COMPLETE, OPTIMIZED, PRODUCTION-READY code.
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Think like you're building for a billion-dollar startup (Stripe, Vercel, Apple level).
- Include automatic improvements: performance, SEO meta tags, accessibility, error handling.
- Premium UI: glassmorphism, smooth animations, micro-interactions, perfect spacing.
- Mobile-first responsive design.
- Clean, componentized code structure.
- Include inline JavaScript with error handling.
- Use emoji or SVG icons, no external icon libraries.
- Start with <!DOCTYPE html> and end with </html>.
- Add invisible improvements the user didn't ask for but needs.
- Focus: PRODUCTION QUALITY + PREMIUM UX + OPTIMIZATION.`;

const MODE_PROMPTS: Record<string, string> = {
  flow: FLOW_PROMPT,
  think: THINK_PROMPT,
  ship: SHIP_PROMPT,
};

const jsonResponse = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// --- Provider call helpers ---

const callKimi = async (
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
) =>
  fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      messages,
      stream: true,
    }),
  });

const callDeepSeek = async (
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
) =>
  fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      stream: true,
    }),
  });

const callLovable = async (
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
) =>
  fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      stream: true,
    }),
  });

const providerFailureMessage = (provider: string, status: number) => {
  if (status === 401) return `${provider}: chave inválida (401)`;
  if (status === 402) return `${provider}: sem créditos (402)`;
  if (status === 404) return `${provider}: modelo/rota não encontrado (404)`;
  if (status === 410) return `${provider}: modelo descontinuado (410)`;
  if (status === 429) return `${provider}: limite de requisições (429)`;
  return `${provider}: erro ${status}`;
};

// --- Try a provider with error handling ---

async function tryProvider(
  name: string,
  callFn: () => Promise<Response>,
  failures: string[],
): Promise<Response | null> {
  try {
    console.log(`Trying ${name}...`);
    const response = await callFn();
    
    if (response.ok) {
      console.log(`Using ${name} ✓`);
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    
    const errorText = await response.text().catch(() => "Unknown error");
    console.warn(`${name} failed:`, response.status, errorText);
    failures.push(providerFailureMessage(name, response.status));
    return null;
  } catch (err) {
    console.error(`${name} fetch error:`, err);
    failures.push(`${name}: erro de conexão`);
    return null;
  }
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, "Unauthorized");
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      return jsonResponse(401, "Unauthorized");
    }

    console.log("User authenticated:", data.user.id);

    // Rate limiting: 30 requests / minute / user to prevent AI quota abuse
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: rl } = await admin.rpc("bump_rate_limit", {
        _bucket: "generate_code",
        _user: data.user.id,
        _window_seconds: 60,
      });
      if (typeof rl === "number" && rl > 30) {
        return jsonResponse(429, "Rate limit exceeded. Try again shortly.");
      }
    } catch (rlErr) {
      console.warn("rate-limit check failed:", rlErr);
    }


    const body = await req.json();
    const rawMessages = body?.messages;
    const mode = body?.mode || "flow";

    if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 20) {
      return jsonResponse(400, "Invalid messages: must be an array of 1-20 items.");
    }

    const messages = rawMessages
      .filter((m: any) => m && typeof m === "object" && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map((m: any) => ({ role: m.role as string, content: m.content.slice(0, 4000) }));

    if (messages.length === 0) {
      return jsonResponse(400, "No valid messages provided.");
    }

    const KIMI_API_KEY = Deno.env.get("KIMI_API_KEY");
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Select system prompt based on KUBO FLOW mode
    const systemPrompt = MODE_PROMPTS[mode] || FLOW_PROMPT;
    console.log(`KUBO FLOW mode: ${mode.toUpperCase()}`);

    const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];
    const failures: string[] = [];
    
    // SHIP mode always routes to heavy providers first
    const heavy = mode === "ship" || isHeavyCodeRequest(messages);
    
    console.log(`Request type: ${heavy ? "HEAVY CODE" : "LIGHT/MEDIUM"}`);

    if (heavy) {
      console.log("Routing: DeepSeek → Kimi → Lovable AI");

      if (DEEPSEEK_API_KEY) {
        const result = await tryProvider("DeepSeek", () => callDeepSeek(DEEPSEEK_API_KEY, fullMessages), failures);
        if (result) return result;
      }

      if (KIMI_API_KEY) {
        const result = await tryProvider("Kimi", () => callKimi(KIMI_API_KEY, fullMessages), failures);
        if (result) return result;
      }

      if (LOVABLE_API_KEY) {
        const result = await tryProvider("Lovable AI", () => callLovable(LOVABLE_API_KEY, fullMessages), failures);
        if (result) return result;
      }
    } else {
      console.log("Routing: Kimi → DeepSeek → Lovable AI");
      // Fluxo otimizado: Front-end tenta Puter.js primeiro (Nível 1).
      // Se cair aqui, é fallback ou processamento de back-end.

      if (KIMI_API_KEY) {
        const result = await tryProvider("Kimi", () => callKimi(KIMI_API_KEY, fullMessages), failures);
        if (result) return result;
      }

      if (DEEPSEEK_API_KEY) {
        const result = await tryProvider("DeepSeek", () => callDeepSeek(DEEPSEEK_API_KEY, fullMessages), failures);
        if (result) return result;
      }

      if (LOVABLE_API_KEY) {
        const result = await tryProvider("Lovable AI", () => callLovable(LOVABLE_API_KEY, fullMessages), failures);
        if (result) return result;
      }
    }

    if (failures.length) console.warn("[generate-code] all providers failed:", failures.join(" | "));
    return jsonResponse(503, "Serviço temporariamente indisponível. Tente novamente mais tarde.");
  } catch (e) {
    console.error("generate-code error:", e);
    return jsonResponse(500, "Something went wrong. Please try again.");
  }
});

// --- Complexity detection ---

function isHeavyCodeRequest(messages: Array<{ role: string; content: string }>): boolean {
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content?.toLowerCase() || "";
  
  const heavyKeywords = [
    "crie um app", "crie uma aplicação", "create an app", "build a",
    "dashboard", "sistema completo", "full system", "e-commerce", "ecommerce",
    "landing page", "website", "página completa", "full page",
    "crud", "formulário complexo", "complex form", "api", "backend",
    "banco de dados", "database", "autenticação", "authentication",
    "gere o código", "generate code", "implementar", "implement",
    "clone", "clonar", "replicar", "replicate",
    "html completo", "complete html", "aplicativo", "application",
    "painel", "admin", "gerenciamento", "management",
  ];
  
  const hasHeavyKeyword = heavyKeywords.some(kw => lastUserMsg.includes(kw));
  const isLongRequest = lastUserMsg.length > 300;
  
  return hasHeavyKeyword || isLongRequest;
}