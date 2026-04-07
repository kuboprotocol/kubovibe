import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { reward_type } = body;

    if (reward_type !== "completed") {
      return new Response(JSON.stringify({ error: "Invalid reward type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check daily ad limit (max 2 per day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("ad_rewards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString());

    if ((count || 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Daily ad limit reached", limit: 10 }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const REWARD_CREDITS = 0.5;

    // Record ad reward
    await supabaseAdmin.from("ad_rewards").insert({
      user_id: userId,
      reward_credits: REWARD_CREDITS,
      ad_type: "unity_rewarded",
    });

    // Add credits to subscription
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, edits_limit")
      .eq("user_id", userId)
      .maybeSingle();

    if (sub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          edits_limit: sub.edits_limit + REWARD_CREDITS,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        plan: "free",
        edits_used: 0,
        edits_limit: 5 + REWARD_CREDITS,
        is_active: true,
      });
    }

    return new Response(
      JSON.stringify({ success: true, credits_earned: REWARD_CREDITS }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("unity-ad-reward error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
