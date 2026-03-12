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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("No auth header found");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", data.user.id);

    const body = await req.json();
    const rawMessages = body?.messages;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 20) {
      return new Response(
        JSON.stringify({ error: "Invalid messages: must be an array of 1-20 items." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = rawMessages
      .filter((m: any) => m && typeof m === "object" && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map((m: any) => ({ role: m.role as string, content: m.content.slice(0, 4000) }));

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid messages provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    console.log("LOVABLE_API_KEY present:", !!LOVABLE_API_KEY);
    console.log("OPENROUTER_API_KEY present:", !!OPENROUTER_API_KEY);

    const fullMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // Try Lovable AI Gateway first
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

        // Only fallback on 402 (no credits) or 429 (rate limit)
        if (response.status !== 402 && response.status !== 429) {
          console.error("Lovable AI non-recoverable error, not falling back");
          return new Response(
            JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Falling back to OpenRouter...");
      } catch (lovableError) {
        console.error("Lovable AI Gateway fetch error:", lovableError);
        console.log("Falling back to OpenRouter...");
      }
    }

    // Fallback to OpenRouter
    if (!OPENROUTER_API_KEY) {
      console.error("No OPENROUTER_API_KEY configured for fallback");
      return new Response(
        JSON.stringify({ error: "AI service not configured. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Using OpenRouter fallback...");
    const fallbackResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kubovibe.lovable.app",
        "X-Title": "KUBO VIBE Builder",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: fullMessages,
        stream: true,
        max_tokens: 10000,
      }),
    });

    if (!fallbackResponse.ok) {
      const errorText = await fallbackResponse.text().catch(() => "Unknown error");
      console.error("OpenRouter error:", fallbackResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI service error (${fallbackResponse.status}). Please try again later.` }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Using OpenRouter ✓");
    return new Response(fallbackResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-code error:", e);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
