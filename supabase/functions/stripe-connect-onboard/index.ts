// ============================================================
// Edge Function: stripe-connect-onboard
// Purpose: Create Stripe Account Links for onboarding (V1 API)
// ============================================================

import Stripe from "npm:stripe@^18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}
const stripeClient = new Stripe(stripeKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id, return_url, refresh_url } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create an Account Link using V1 API for onboarding
    const accountLink = await stripeClient.accountLinks.create({
      account: account_id,
      type: "account_onboarding",
      refresh_url: refresh_url || "https://kubovibe.lovable.app/connect",
      return_url:
        return_url ||
        `https://kubovibe.lovable.app/connect?accountId=${account_id}`,
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("stripe-connect-onboard error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
