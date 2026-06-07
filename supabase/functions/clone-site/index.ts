import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePublicUrl } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLONE_SYSTEM_PROMPT = `You are an elite frontend developer who clones websites with pixel-perfect accuracy. You receive detailed scraped data from a website including its full HTML, extracted branding (colors, fonts, spacing), content, and link structure.

Your task: Recreate an EXACT visual clone as a single, complete, self-contained HTML file.

CRITICAL RULES:
- Output ONLY the raw HTML code. No explanations, no markdown fences, no comments before <!DOCTYPE html>.
- Start with <!DOCTYPE html> and end with </html>.
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Configure Tailwind with the EXACT colors, fonts, and spacing extracted from the branding data using a <script> block to extend the theme.
- Replicate EVERY section: header/nav, hero, features, content sections, footer, etc.
- Preserve ALL text content exactly as provided - do not summarize or shorten.
- Use the EXACT original image URLs when available. For missing images, use https://placehold.co/ with matching dimensions and colors.
- Match the color scheme EXACTLY using the extracted brand colors.
- Include Font Awesome CDN for icons: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
- Load Google Fonts matching the original site's typography.
- Include inline JavaScript for ALL interactive elements (mobile menus, dropdowns, modals, tabs, sliders, accordions).
- Make it fully responsive matching the original site's breakpoints.
- The HTML must be complete and runnable standalone in an iframe.
- For DApps/Web3 UIs: replicate wallet buttons, token displays, swap interfaces, charts faithfully.
- Match shadows, border-radius, gradients, hover effects, and transitions.
- If the original uses animations, add CSS transitions/animations to match.`;

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

    let rawUrl = url.trim();
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      rawUrl = `https://${rawUrl}`;
    }
    const formattedUrl = validatePublicUrl(rawUrl).toString();

    // Step 1: Scrape with Firecrawl (HTML + branding + markdown + links)
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return jsonResponse(500, { error: "Firecrawl not configured. Connect the Firecrawl service first." });
    }

    console.log("Step 1: Scraping", formattedUrl, "with branding extraction...");

    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["html", "markdown", "links", "branding"],
        onlyMainContent: false,
        waitFor: 5000,
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
    const branding = scrapeData?.data?.branding || scrapeData?.branding || null;

    console.log("Scrape successful. HTML:", scrapedHtml.length, "chars | Branding:", branding ? "YES" : "NO");

    // Step 2: Build a rich AI prompt with all extracted data
    // Allow more HTML for better fidelity (up to 50k chars)
    const truncatedHtml = scrapedHtml.slice(0, 50000);
    const truncatedMarkdown = scrapedMarkdown.slice(0, 15000);

    let brandingSection = "";
    if (branding) {
      brandingSection = `
## Extracted Brand Design (USE THESE EXACT VALUES):
- Color Scheme: ${branding.colorScheme || "unknown"}
- Logo: ${branding.logo || branding.images?.logo || "N/A"}
${branding.colors ? `- Colors:
  - Primary: ${branding.colors.primary || "N/A"}
  - Secondary: ${branding.colors.secondary || "N/A"}
  - Accent: ${branding.colors.accent || "N/A"}
  - Background: ${branding.colors.background || "N/A"}
  - Text Primary: ${branding.colors.textPrimary || "N/A"}
  - Text Secondary: ${branding.colors.textSecondary || "N/A"}` : ""}
${branding.typography ? `- Typography:
  - Primary Font: ${branding.typography.fontFamilies?.primary || "N/A"}
  - Heading Font: ${branding.typography.fontFamilies?.heading || "N/A"}
  - Code Font: ${branding.typography.fontFamilies?.code || "N/A"}
  - H1 Size: ${branding.typography.fontSizes?.h1 || "N/A"}
  - H2 Size: ${branding.typography.fontSizes?.h2 || "N/A"}
  - Body Size: ${branding.typography.fontSizes?.body || "N/A"}` : ""}
${branding.spacing ? `- Spacing:
  - Base Unit: ${branding.spacing.baseUnit || "N/A"}px
  - Border Radius: ${branding.spacing.borderRadius || "N/A"}` : ""}
${branding.fonts?.length ? `- Fonts Used: ${branding.fonts.map((f: any) => f.family).join(", ")}` : ""}
${branding.components?.buttonPrimary ? `- Primary Button: bg=${branding.components.buttonPrimary.background}, text=${branding.components.buttonPrimary.textColor}, radius=${branding.components.buttonPrimary.borderRadius}` : ""}`;
    }

    const clonePrompt = `Clone this website EXACTLY: ${formattedUrl}

## Website Metadata
- Title: ${metadata.title || "Unknown"}
- Description: ${metadata.description || "N/A"}
- Language: ${metadata.language || "en"}
${brandingSection}

## Full HTML Structure:
\`\`\`html
${truncatedHtml}
\`\`\`

## Full Text Content (Markdown):
${truncatedMarkdown}

## Navigation Links: ${scrapedLinks.slice(0, 30).join(", ")}

IMPORTANT: Recreate this website as a PIXEL-PERFECT single HTML file. Use the exact brand colors, fonts, and spacing provided above. Preserve all text content, images, and layout structure.`;

    // Step 3: Generate clone with DeepSeek (heavy code task) or fallbacks
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const KIMI_API_KEY = Deno.env.get("KIMI_API_KEY");

    const fullMessages = [
      { role: "system", content: CLONE_SYSTEM_PROMPT },
      { role: "user", content: clonePrompt },
    ];

    let aiResponse: Response | null = null;

    // PRIMARY: DeepSeek (best for heavy code generation)
    if (DEEPSEEK_API_KEY) {
      console.log("Step 2: Generating clone with DeepSeek (heavy code)...");
      const dsResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-coder",
          messages: fullMessages,
          stream: true,
          max_tokens: 16384,
          temperature: 0.2,
        }),
      });

      if (dsResp.ok) {
        aiResponse = dsResp;
        console.log("Using DeepSeek for clone ✓");
      } else {
        const errText = await dsResp.text().catch(() => "");
        console.warn("DeepSeek failed for clone:", dsResp.status, errText);
      }
    }

    // FALLBACK 1: Lovable AI (Gemini)
    if (!aiResponse && LOVABLE_API_KEY) {
      console.log("Step 2: Fallback to Lovable AI for clone...");
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
        console.error("Lovable AI failed:", lovResp.status, errText);
      }
    }

    // FALLBACK 2: Kimi
    if (!aiResponse && KIMI_API_KEY) {
      console.log("Step 2: Fallback to Kimi for clone...");
      const kimiResp = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIMI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "moonshot-v1-32k",
          messages: fullMessages,
          stream: true,
        }),
      });

      if (kimiResp.ok) {
        aiResponse = kimiResp;
        console.log("Using Kimi for clone ✓");
      } else {
        const errText = await kimiResp.text().catch(() => "");
        console.error("Kimi also failed:", kimiResp.status, errText);
      }
    }

    if (!aiResponse) {
      return jsonResponse(402, { error: "Nenhum serviço de IA disponível. Verifique suas chaves de API." });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("clone-site error:", e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
