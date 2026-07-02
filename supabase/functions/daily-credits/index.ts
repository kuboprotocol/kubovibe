import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, plan, edits_limit, last_daily_credit_at, signup_credits_granted")
      .eq("user_id", user.id)
      .maybeSingle();
    const plan = sub?.plan ?? "free";
    const today = new Date().toISOString().split("T")[0];
    const lastCreditDate = sub?.last_daily_credit_at
      ? new Date(sub.last_daily_credit_at).toISOString().split("T")[0]
      : null;
    const { data: planConfig } = await supabase
      .from("plan_config")
      .select("daily_credits, signup_credits")
      .eq("plan", plan)
      .maybeSingle();
    const dailyCredits = Number(planConfig?.daily_credits ?? 0);
    const signupCredits = Number(planConfig?.signup_credits ?? 0);

    if (plan === "free") {
      if (sub?.signup_credits_granted) {
        return new Response(
          JSON.stringify({ success: true, credited: false, plan, message: "Signup credits already granted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (sub) {
        await supabase
          .from("subscriptions")
          .update({
            edits_limit: (sub.edits_limit ?? 0) + signupCredits,
            signup_credits_granted: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      } else {
        await supabase.from("subscriptions").insert({
          user_id: user.id,
          plan: "free",
          edits_used: 0,
          edits_limit: signupCredits,
          is_active: true,
          signup_credits_granted: true,
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          credited: true,
          plan,
          credits_granted: signupCredits,
          type: "signup",
          message: `🎉 Welcome! +${signupCredits} signup credits`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (lastCreditDate === today) {
      return new Response(
        JSON.stringify({ success: true, credited: false, plan, message: "Already credited today" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (sub) {
      await supabase
        .from("subscriptions")
        .update({
          edits_limit: (sub.edits_limit ?? 0) + dailyCredits,
          last_daily_credit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan,
        edits_used: 0,
        edits_limit: dailyCredits,
        is_active: true,
        last_daily_credit_at: new Date().toISOString(),
      });
    }
    return new Response(
      JSON.stringify({
        success: true,
        credited: true,
        plan,
        credits_granted: dailyCredits,
        type: "daily",
        message: `+${dailyCredits} credits — ${plan} plan`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
