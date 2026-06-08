// Nano Banana — image generation via Lovable AI Gateway (google/gemini-2.5-flash-image)
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

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return j(500, { error: "LOVABLE_API_KEY missing" });

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    const data = await r.json();
    if (!r.ok) return j(r.status, { error: data?.error?.message || "image gen failed", details: data });

    const imageUrl: string | null =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;

    const assetId = await recordAsset(user.id, {
      tool: "nano_banana",
      prompt,
      output_url: imageUrl ?? undefined,
      credits_spent: COST,
      metadata: { size: size ?? "1024x1024" },
    });

    return j(200, { ok: true, image_url: imageUrl, asset_id: assetId });
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
