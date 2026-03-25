import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLONE_SYSTEM_PROMPT = `You are an expert frontend developer specialized in cloning websites. You will receive scraped data from a website including its HTML structure, content, and design details.

Your task: Recreate a visually identical clone of the website as a single, complete, self-contained HTML file.

Rules:
- Output ONLY the HTML code. No explanations, no markdown fences.
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Replicate the exact visual design: colors, typography, spacing, layout, images.
- Preserve all text content, headings, paragraphs, lists, and links.
- For images, use the original URLs when available, or placeholder images from https://placehold.co/ with appropriate sizes.
- Make it responsive, matching the original site's responsive behavior.
- Include inline JavaScript for any interactive elements (menus, dropdowns, modals, tabs, sliders).
- Use Font Awesome CDN for icons if the original uses icons: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
- For DApps or Web3 interfaces, replicate the UI layout faithfully (wallet connect buttons, token displays, swap interfaces, etc.).
- The HTML must be complete and runnable in an iframe.
- Start with <!DOCTYPE html> and end with </html>.
- Match the color scheme exactly. If you can identify specific hex/rgb colors from the HTML, use those exact values.
- Preserve the overall page structure and visual hierarchy.`;

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    console.log("User authenticated for clone:", authData.user.id);

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return jsonResponse(400, { error: "URL is required" });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Step 1: Scrape with Firecrawl
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return jsonResponse(500, { error: "Firecrawl not configured. Connect the Firecrawl service first." });
    }

    console.log("Step 1: Scraping", formattedUrl);

    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "html", "links", "screenshot"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errData = await scrapeResponse.text().catch(() => "Unknown");
      console.error("Firecrawl scrape failed:", scrapeResponse.status, errData);
      return jsonResponse(502, { error: `Failed to scrape the website (${scrapeResponse.status}). Check if the URL is accessible.` });
    }

    const scrapeData = await scrapeResponse.json();
    const scrapedHtml = scrapeData?.data?.html || scrapeData?.html || "";
    const scrapedMarkdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
    const scrapedLinks = scrapeData?.data?.links || scrapeData?.links || [];
    const metadata = scrapeData?.data?.metadata || scrapeData?.metadata || {};

    console.log("Scrape successful. HTML length:", scrapedHtml.length, "Markdown length:", scrapedMarkdown.length);

    // Step 2: Build AI prompt with scraped data
    const truncatedHtml = scrapedHtml.slice(0, 15000);
    const truncatedMarkdown = scrapedMarkdown.slice(0, 8000);

    const clonePrompt = `Clone this website: ${formattedUrl}

## Website Metadata
- Title: ${metadata.title || "Unknown"}
- Description: ${metadata.description || "N/A"}

## HTML Structure (truncated):
\`\`\`html
${truncatedHtml}
\`\`\`

## Content (Markdown):
${truncatedMarkdown}

## Links found: ${scrapedLinks.slice(0, 20).join(", ")}

Recreate this website as a single HTML file with Tailwind CSS, matching the visual design as closely as possible.`;

    // Step 3: Generate clone with AI (streaming)
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const fullMessages = [
      { role: "system", content: CLONE_SYSTEM_PROMPT },
      { role: "user", content: clonePrompt },
    ];

    let aiResponse: Response | null = null;

    // Try OpenRouter first
    if (OPENROUTER_API_KEY) {
      console.log("Step 2: Generating clone with OpenRouter...");
      const orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://kubovibe.lovable.app",
          "X-Title": "KUBO VIBE Clone",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: fullMessages,
          stream: true,
          max_tokens: 16000,
        }),
      });

      if (orResp.ok) {
        aiResponse = orResp;
        console.log("Using OpenRouter for clone ✓");
      } else {
        console.warn("OpenRouter failed for clone:", orResp.status);
      }
    }

    // Fallback to Lovable AI
    if (!aiResponse && LOVABLE_API_KEY) {
      console.log("Step 2: Generating clone with Lovable AI...");
      const lovResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

      if (lovResp.ok) {
        aiResponse = lovResp;
        console.log("Using Lovable AI for clone ✓");
      } else {
        const errText = await lovResp.text().catch(() => "");
        console.error("Lovable AI also failed:", lovResp.status, errText);
      }
    }

    if (!aiResponse) {
      // Check if both failed due to credits/rate limits
      return jsonResponse(402, { error: "Sem créditos suficientes no serviço de IA. Recarregue seus créditos ou tente novamente mais tarde." });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("clone-site error:", e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
