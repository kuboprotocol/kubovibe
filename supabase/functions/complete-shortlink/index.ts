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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { click_id } = await req.json();
    if (!click_id) {
      return new Response(JSON.stringify({ error: "click_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the click record
    const { data: click, error: clickErr } = await supabaseAdmin
      .from("shortlink_clicks")
      .select("*, shortlinks(*)")
      .eq("id", click_id)
      .eq("user_id", user.id)
      .eq("completed", false)
      .maybeSingle();

    if (clickErr || !click) {
      return new Response(JSON.stringify({ error: "Click not found or already completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reward = click.shortlinks?.reward_credits || 0.5;

    // Mark click as completed
    await supabaseAdmin
      .from("shortlink_clicks")
      .update({
        completed: true,
        reward_credited: reward,
        completed_at: new Date().toISOString(),
      })
      .eq("id", click_id);

    // Add credits to subscription
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, edits_limit")
      .eq("user_id", user.id)
      .maybeSingle();

    if (sub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          edits_limit: sub.edits_limit + reward,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    } else {
      // Create subscription with reward credits
      await supabaseAdmin
        .from("subscriptions")
        .insert({
          user_id: user.id,
          plan: "free",
          edits_used: 0,
          edits_limit: 5 + reward,
          is_active: true,
        });
    }

    return new Response(
      JSON.stringify({ success: true, credits_earned: reward }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("complete-shortlink error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
