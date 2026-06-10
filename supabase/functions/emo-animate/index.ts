import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";

const COST = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const authHeader = req.headers.get("Authorization");
  const user = await getUser(authHeader);
  
  console.log("[emo-animate] Início da requisição", { 
    method: req.method, 
    hasAuth: !!authHeader,
    userId: user?.id 
  });

  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const body = await req.json().catch(() => ({}));
    console.log("[emo-animate] Payload recebido:", body);
    
    const { source_image, driving_video, metadata } = body;
    const rawImg = source_image || metadata?.source_image;
    const rawVid = driving_video || metadata?.driving_video;
    
    console.log("[emo-animate] Assets a processar:", { rawImg, rawVid });

    if (!rawImg || !rawVid) {
      throw new Error(`Missing source_image or driving_video. Received: ${JSON.stringify(body)}`);
    }

    const ded = await deductCredits(user.id, COST, "creative_emo", { rawImg, rawVid }, user.email, idempotencyKey);
    if (!ded.ok) return new Response(JSON.stringify({ error: ded.error }), { status: (ded as any).status ?? 402, headers: corsHeaders });

    // Call external FastAPI backend
    const EMO_BACKEND_URL = Deno.env.get("EMO_BACKEND_URL");
    
    if (!EMO_BACKEND_URL) {
      console.warn("EMO_BACKEND_URL not set, returning mock result.");
      
      const asset_id = await recordAsset(user.id, {
        tool: "emo",
        prompt: "EMO Animation",
        status: "completed",
        credits_spent: COST,
        output_url: "https://vjrqosvkvfyzfqqyqyqy.supabase.co/storage/v1/object/public/uploads/demo/emo_result.mp4",
        metadata: { source_image: rawImg, driving_video: rawVid }
      });

      return new Response(JSON.stringify({ status: "success", video: "output/result.mp4", asset_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = new FormData();
    const imgRes = await fetch(rawImg);
    const imgBlob = await imgRes.blob();
    formData.append("source_image", imgBlob, "source.jpg");

    const vidRes = await fetch(rawVid);
    const vidBlob = await vidRes.blob();
    formData.append("driving_video", vidBlob, "driving.mp4");

    const response = await fetch(`${EMO_BACKEND_URL}/animate`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`EMO Backend Error: ${err}`);
    }

    const result = await response.json();

    const asset_id = await recordAsset(user.id, {
      tool: "emo",
      prompt: "EMO Animation",
      status: "completed",
      credits_spent: COST,
      output_url: result.video.startsWith("http") ? result.video : `${EMO_BACKEND_URL}/${result.video}`,
      metadata: { source_image: rawImg, driving_video: rawVid }
    });

    return new Response(JSON.stringify({ ...result, asset_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: sanitizeError(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
