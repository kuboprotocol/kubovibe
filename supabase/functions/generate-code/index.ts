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

const jsonResponse = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    const KIMI_API_KEY = Deno.env.get("KIMI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    console.log("KIMI_API_KEY present:", !!KIMI_API_KEY);
    console.log("LOVABLE_API_KEY present:", !!LOVABLE_API_KEY);

    const fullMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // PRIMARY: Kimi (Moonshot AI)
    if (KIMI_API_KEY) {
      console.log("Trying Kimi (primary)...");
      const kimiResponse = await callKimi(KIMI_API_KEY, fullMessages);

      if (kimiResponse.ok) {
        console.log("Using Kimi ✓");
        return new Response(kimiResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      const kimiError = await kimiResponse.text().catch(() => "Unknown error");
      console.warn("Kimi failed:", kimiResponse.status, kimiError);

      if (kimiResponse.status === 429) {
        console.log("Kimi rate limited, falling back to Lovable AI...");
      } else if (kimiResponse.status === 402 || kimiResponse.status === 401) {
        console.log("Kimi auth/credit issue, falling back to Lovable AI...");
      }
    }

    // FALLBACK: Lovable AI Gateway
    if (LOVABLE_API_KEY) {
      console.log("Trying Lovable AI Gateway (fallback)...");
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
        console.error("Lovable AI also failed:", response.status, errorText);
      } catch (lovableError) {
        console.error("Lovable AI Gateway fetch error:", lovableError);
      }
    }

    return jsonResponse(503, "Nenhum serviço de IA disponível no momento. Tente novamente mais tarde.");
  } catch (e) {
    console.error("generate-code error:", e);
    return jsonResponse(500, "Something went wrong. Please try again.");
  }
});
