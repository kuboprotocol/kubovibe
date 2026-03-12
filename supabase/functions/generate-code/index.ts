import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert frontend developer. The user will describe an app or feature they want to build. You must generate a single, complete, self-contained HTML file that implements it.

Rules:
- Output ONLY the HTML code. No explanations, no markdown fences.
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Use modern, clean UI design with good spacing, colors, and typography.
- Make it responsive and visually polished.
- Include inline JavaScript for interactivity when needed.
- Use emoji or SVG icons, no external icon libraries.
- The HTML must be complete and runnable in an iframe.
- Start with <!DOCTYPE html> and end with </html>.`;

const OPENROUTER_DEFAULT_MAX_TOKENS = 8000;
const OPENROUTER_MIN_MAX_TOKENS = 512;

const jsonResponse = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseAffordableTokens = (errorText: string): number | null => {
  const fromMessage = errorText.match(/can only afford\s+(\d+)/i);
  if (fromMessage) return Number(fromMessage[1]);

  try {
    const parsed = JSON.parse(errorText);
    const message = parsed?.error?.message;
    if (typeof message === "string") {
      const fromJsonMessage = message.match(/can only afford\s+(\d+)/i);
      if (fromJsonMessage) return Number(fromJsonMessage[1]);
    }
  } catch {
    // ignore parsing errors
  }

  return null;
};

const callOpenRouter = async (
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
) =>
  fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kubovibe.lovable.app",
      "X-Title": "KUBO VIBE Builder",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      stream: true,
      max_tokens: maxTokens,
    }),
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("No auth header found");
      return jsonResponse(401, "Unauthorized");
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      console.error("Auth error:", authError?.message);
      return jsonResponse(401, "Unauthorized");
    }

    console.log("User authenticated:", data.user.id);

    const body = await req.json();
    const rawMessages = body?.messages;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 20) {
      return jsonResponse(400, "Invalid messages: must be an array of 1-20 items.");
    }

    const messages = rawMessages
      .filter((m: any) => m && typeof m === "object" && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map((m: any) => ({ role: m.role as string, content: m.content.slice(0, 4000) }));

    if (messages.length === 0) {
      return jsonResponse(400, "No valid messages provided.");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    console.log("LOVABLE_API_KEY present:", !!LOVABLE_API_KEY);
    console.log("OPENROUTER_API_KEY present:", !!OPENROUTER_API_KEY);

    const fullMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    if (LOVABLE_API_KEY) {
      console.log("Trying Lovable AI Gateway...");
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: fullMessages,
            stream: true,
          }),
        });

        if (response.ok) {
          console.log("Using Lovable AI Gateway ✓");
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        const errorText = await response.text().catch(() => "Unknown error");
        console.warn("Lovable AI failed:", response.status, errorText);

        if (response.status !== 402 && response.status !== 429) {
          return jsonResponse(503, "AI service temporarily unavailable. Please try again.");
        }

        console.log("Falling back to OpenRouter...");
      } catch (lovableError) {
        console.error("Lovable AI Gateway fetch error:", lovableError);
        console.log("Falling back to OpenRouter...");
      }
    }

    if (!OPENROUTER_API_KEY) {
      console.error("No OPENROUTER_API_KEY configured for fallback");
      return jsonResponse(500, "AI service not configured. Please contact support.");
    }

    console.log("Using OpenRouter fallback...");
    let maxTokens = OPENROUTER_DEFAULT_MAX_TOKENS;
    let fallbackResponse = await callOpenRouter(OPENROUTER_API_KEY, fullMessages, maxTokens);

    if (!fallbackResponse.ok && fallbackResponse.status === 402) {
      const errorText = await fallbackResponse.text().catch(() => "Unknown error");
      console.warn("OpenRouter 402 on first attempt:", errorText);

      const affordableTokens = parseAffordableTokens(errorText);
      if (
        affordableTokens &&
        Number.isFinite(affordableTokens) &&
        affordableTokens >= OPENROUTER_MIN_MAX_TOKENS &&
        affordableTokens < maxTokens
      ) {
        maxTokens = affordableTokens;
        console.log(`Retrying OpenRouter with reduced max_tokens=${maxTokens}...`);
        fallbackResponse = await callOpenRouter(OPENROUTER_API_KEY, fullMessages, maxTokens);
      } else {
        return jsonResponse(402, "Serviço de IA sem créditos suficientes. Tente um prompt menor ou adicione créditos.");
      }
    }

    if (!fallbackResponse.ok) {
      const errorText = await fallbackResponse.text().catch(() => "Unknown error");
      console.error("OpenRouter error:", fallbackResponse.status, errorText);

      if (fallbackResponse.status === 402) {
        return jsonResponse(402, "Serviço de IA sem créditos suficientes. Tente um prompt menor ou adicione créditos.");
      }

      if (fallbackResponse.status === 429) {
        return jsonResponse(429, "Muitas requisições agora. Aguarde alguns segundos e tente novamente.");
      }

      return jsonResponse(503, `AI service error (${fallbackResponse.status}). Please try again later.`);
    }

    console.log("Using OpenRouter ✓");
    return new Response(fallbackResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-code error:", e);
    return jsonResponse(500, "Something went wrong. Please try again.");
  }
});
