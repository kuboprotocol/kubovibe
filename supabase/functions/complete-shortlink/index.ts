import { createClient } from "npm:@supabase/supabase-js@^2";

import { corsHeaders, sanitizeError } from "../_shared/cors.ts";

const MIN_WAIT_SECONDS = 5;
const DAILY_LINK_LIMIT = 10;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Auth via getClaims
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !userRes?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = userRes.user.id;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("cf-connecting-ip") || "unknown";

    const { click_id } = await req.json();
    if (!click_id || typeof click_id !== "string") {
      return json({ error: "click_id required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── ANTI-FRAUD 1: Get click record & verify ownership ──
    const { data: click, error: clickErr } = await supabaseAdmin
      .from("shortlink_clicks")
      .select("*, shortlinks(*)")
      .eq("id", click_id)
      .eq("user_id", userId)
      .eq("completed", false)
      .maybeSingle();

    if (clickErr || !click) {
      return json({ error: "Já concluído ou não encontrado" }, 400);
    }

    // ── ANTI-FRAUD 2: Minimum time elapsed (5s) ──
    const clickedAt = new Date(click.clicked_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - clickedAt) / 1000;
    const requiredWait = Math.max(MIN_WAIT_SECONDS, click.shortlinks?.wait_seconds || 8);

    if (elapsedSeconds < requiredWait) {
      console.warn(`⚠️ Fraud attempt: user ${userId} tried to complete in ${elapsedSeconds.toFixed(1)}s (min: ${requiredWait}s)`);
      return json({ error: "Tempo mínimo não atingido. Aguarde." }, 429);
    }

    // ── ANTI-FRAUD 3: Daily limit check ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCompleted } = await supabaseAdmin
      .from("shortlink_clicks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("clicked_at", todayStart.toISOString());

    if ((todayCompleted || 0) >= DAILY_LINK_LIMIT) {
      return json({ error: "Limite diário atingido", limit: DAILY_LINK_LIMIT }, 429);
    }

    // ── ANTI-FRAUD 4: No duplicate link per day ──
    const { count: sameLink } = await supabaseAdmin
      .from("shortlink_clicks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("shortlink_id", click.shortlink_id)
      .eq("completed", true)
      .gte("clicked_at", todayStart.toISOString());

    if ((sameLink || 0) > 0) {
      return json({ error: "Este link já foi completado hoje" }, 400);
    }

    const reward = click.shortlinks?.reward_credits || 0.5;

    // ── Mark click as completed with IP ──
    await supabaseAdmin
      .from("shortlink_clicks")
      .update({
        completed: true,
        reward_credited: reward,
        completed_at: new Date().toISOString(),
        ip_address: clientIp,
      })
      .eq("id", click_id);

    // ── Add credits to subscription (Atomic via RPC) ──
    const { error: rpcErr } = await supabaseAdmin.rpc("grant_credits", {
      p_user_id: userId,
      p_amount: reward,
    });

    if (rpcErr) {
      console.error("Failed to grant credits:", rpcErr);
      // We don't fail the request because the click was already marked completed,
      // but we log it for manual correction if needed.
    }

    console.log(`✅ User ${userId} earned ${reward} credits from link ${click.shortlink_id} (IP: ${clientIp}, elapsed: ${elapsedSeconds.toFixed(1)}s)`);

    return json({ success: true, credits_earned: reward });
  } catch (err: any) {
    console.error("complete-shortlink error:", err);
    return json({ error: sanitizeError(err) }, 500);
  }
});
