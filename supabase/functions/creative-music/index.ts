// Kubo Music AI — Suno API integration. Async: start + status.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, supaAdmin } from "../_shared/creative.ts";

const COST_GEN = 1;            // rounded from 0.001
const COST_DOWNLOAD_MP3 = 1;
const COST_DOWNLOAD_WAV = 2;

const SUNO_BASE = Deno.env.get("SUNO_API_BASE") ?? "https://apibox.erweima.ai";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return j(401, { error: "Unauthorized" });

  try {
    const body = await req.json();
    const action = body.action ?? "generate";
    const key = Deno.env.get("SUNO_API_KEY");
    if (!key) return j(500, { error: "SUNO_API_KEY missing" });

    if (action === "generate") {
      const { prompt, instrumental = false, style = "" } = body;
      if (!prompt) return j(400, { error: "prompt required" });

      const ded = await deductCredits(user.id, COST_GEN, "creative_music_gen", { prompt }, user.email);
      if (!ded.ok) return j(402, { error: ded.error });

      const r = await fetch(`${SUNO_BASE}/api/v1/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          customMode: false,
          instrumental,
          style,
          model: "V4",
          callBackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/creative-music`, // placeholder, polled instead
        }),
      });
      const data = await r.json();
      if (!r.ok || data?.code !== 200) {
        return j(r.status || 500, { error: data?.msg ?? "Suno error", details: data });
      }
      const taskId = data?.data?.taskId;
      const assetId = await recordAsset(user.id, {
        tool: "music",
        status: "processing",
        prompt,
        credits_spent: COST_GEN,
        metadata: { task_id: taskId, instrumental, style },
      });
      return j(200, { ok: true, task_id: taskId, asset_id: assetId });
    }

    if (action === "status") {
      const { task_id, asset_id } = body;
      if (!task_id) return j(400, { error: "task_id required" });
      const r = await fetch(`${SUNO_BASE}/api/v1/generate/record-info?taskId=${task_id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await r.json();
      const items = data?.data?.response?.sunoData ?? [];
      const ready = items.filter((x: any) => x.audioUrl);
      if (ready.length > 0 && asset_id) {
        await supaAdmin().from("creative_assets").update({
          status: "completed",
          output_url: ready[0].audioUrl,
          metadata: { task_id, items: ready },
        }).eq("id", asset_id).eq("user_id", user.id);
      }
      return j(200, { ok: true, status: data?.data?.status, items });
    }

    if (action === "download") {
      const { format = "mp3", asset_id } = body;
      const cost = format === "wav" ? COST_DOWNLOAD_WAV : COST_DOWNLOAD_MP3;
      const ded = await deductCredits(user.id, cost, `creative_music_download_${format}`, { asset_id }, user.email);
      if (!ded.ok) return j(402, { error: ded.error });
      return j(200, { ok: true });
    }

    return j(400, { error: "invalid action" });
  } catch (e) {
    return j(500, { error: e instanceof Error ? e.message : "error" });
  }
});

function j(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
