// ============================================================
// Edge Function: stripe-connect-onboard
// Purpose: Create Stripe Account Links for onboarding connected accounts
// ============================================================

import Stripe from "npm:stripe@^18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PLACEHOLDER: Ensure STRIPE_SECRET_KEY is configured
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

    // Create an Account Link using the V2 API
    // - use_case: 'account_onboarding' walks the user through Stripe's KYC flow
    // - configurations: ['recipient'] matches our account configuration
    // - return_url: where Stripe redirects after onboarding completes
    // - refresh_url: where Stripe redirects if the link expires
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: account_id,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: refresh_url || "https://kubovibe.lovable.app/connect",
          return_url:
            return_url ||
            `https://kubovibe.lovable.app/connect?accountId=${account_id}`,
        },
      },
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
