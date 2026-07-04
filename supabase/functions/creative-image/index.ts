                                                                                                              // Image generation: Lovable Gateway (Nano Banana) primary, Bytez fallback.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";

const COST = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return j(401, { error: "Unauthorized" });

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const { prompt, size } = await req.json();
    if (!prompt || typeof prompt !== "string") return j(400, { error: "prompt required" });

    const ded = await deductCredits(user.id, COST, "creative_image", { prompt }, user.email, idempotencyKey);
    if (!ded.ok) return j((ded as any).status ?? 402, { error: ded.error });

    const LK = Deno.env.get("LOVABLE_API_KEY");
    const BYTEZ = Deno.env.get("BYTEZ_API_KEY");

    // 1) Primary: Lovable Gateway (Gemini 2.5 Flash Image / Nano Banana)
    if (LK) {
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LK}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });
        const data = await r.json();
        if (r.ok) {
          const imageUrl: string | null = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
          if (imageUrl) {
            const assetId = await recordAsset(user.id, {
              tool: "nano_banana", prompt, output_url: imageUrl, credits_spent: COST,
              metadata: { size: size ?? "1024x1024", provider: "lovable_gemini" },
            });
            return j(200, { ok: true, image_url: imageUrl, asset_id: assetId, provider: "lovable_gemini" });
          }
        }
        console.warn("[creative-image] lovable failed:", r.status, data?.error?.message);
      } catch (e) {
        console.warn("[creative-image] lovable threw:", e);
      }
    }

    // 2) Fallback: Bytez (Stable Diffusion XL)
    if (BYTEZ) {
      try {
        const r = await fetch("https://api.bytez.com/models/v2/stabilityai/stable-diffusion-xl-base-1.0", {
          method: "POST",
          headers: { Authorization: BYTEZ, "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
        });
        const data = await r.json();
        if (r.ok) {
          const url: string | null = data?.output?.url ?? data?.output ?? data?.result ?? null;
          if (typeof url === "string") {
            const assetId = await recordAsset(user.id, {
              tool: "nano_banana", prompt, output_url: url, credits_spent: COST,
              metadata: { size: size ?? "1024x1024", provider: "bytez_sdxl" },
            });
            return j(200, { ok: true, image_url: url, asset_id: assetId, provider: "bytez_sdxl" });
          }
        }
        console.warn("[creative-image] bytez failed:", r.status);
      } catch (e) {
        console.warn("[creative-image] bytez threw:", e);
      }
    }

    return j(503, { error: "image_provider_unavailable" });
  } catch (e) {
    console.error("[creative-image] error:", e);
    return j(500, { error: sanitizeError(e) });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
