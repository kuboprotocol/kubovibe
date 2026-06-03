// Downloader Universal — usa a API pública do cobalt.tools.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset } from "../_shared/creative.ts";

const COST = 2;
const COBALT = Deno.env.get("COBALT_API_URL") ?? "https://api.cobalt.tools/api/json";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return j(401, { error: "Unauthorized" });

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const { url, format = "mp4" } = await req.json();
    if (!url) return j(400, { error: "url required" });

    const ded = await deductCredits(user.id, COST, "creative_download", { url, format }, user.email, idempotencyKey);
    if (!ded.ok) return j(402, { error: ded.error });

    const r = await fetch(COBALT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        url,
        isAudioOnly: format === "mp3",
        aFormat: "mp3",
        vQuality: "720",
      }),
    });
    const data = await r.json().catch(() => ({}));
    const downloadUrl: string | null = data?.url ?? data?.data?.url ?? null;

    const assetId = await recordAsset(user.id, {
      tool: "downloader",
      prompt: url,
      output_url: downloadUrl ?? undefined,
      credits_spent: COST,
      metadata: { format, raw: data },
      status: downloadUrl ? "completed" : "failed",
    });

    if (!downloadUrl) {
      return j(502, { error: "Não foi possível obter o link de download.", details: data, asset_id: assetId });
    }

    return j(200, { ok: true, download_url: downloadUrl, asset_id: assetId });
  } catch (e) {
    return j(500, { error: e instanceof Error ? e.message : "error" });
  }
});

function j(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
