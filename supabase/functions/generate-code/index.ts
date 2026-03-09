import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function callDeepSeek(messages: any[], apiKey: string) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    }),
  });
  return response;
}

async function callLovableAI(messages: any[], apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    }),
  });
  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let response: Response | null = null;
    let usedProvider = "";

    // Try DeepSeek first
    if (DEEPSEEK_API_KEY) {
      try {
        response = await callDeepSeek(messages, DEEPSEEK_API_KEY);
        if (response.ok) {
          usedProvider = "deepseek";
        } else {
          console.error("DeepSeek error:", response.status, await response.text());
          response = null;
        }
      } catch (e) {
        console.error("DeepSeek failed:", e);
        response = null;
      }
    }

    // Fallback to Lovable AI
    if (!response && LOVABLE_API_KEY) {
      response = await callLovableAI(messages, LOVABLE_API_KEY);
      usedProvider = "lovable";
    }

    if (!response) {
      throw new Error("No AI provider available");
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error(`${usedProvider} error:`, response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-code error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
