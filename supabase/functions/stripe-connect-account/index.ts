// ============================================================
// Edge Function: stripe-connect-account
// Purpose: Create and retrieve Stripe Connected Accounts (V2 API)
// ============================================================

import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

// CORS headers required for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---- Initialize Stripe Client ----
// PLACEHOLDER: Ensure STRIPE_SECRET_KEY is set in your project secrets.
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeKey) {
  throw new Error(
    "Missing STRIPE_SECRET_KEY. Add it via Lovable Cloud secrets."
  );
}
const stripeClient = new Stripe(stripeKey);

// ---- Initialize Supabase Admin Client ----
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ---- ACTION: Create a new Connected Account ----
    if (req.method === "POST" && action === "create") {
      const { display_name, contact_email } = await req.json();

      if (!display_name || !contact_email) {
        return new Response(
          JSON.stringify({ error: "display_name and contact_email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Create a V2 Connected Account via Stripe
      // - dashboard: 'express' → Stripe-hosted dashboard for the connected account
      // - responsibilities: platform collects fees and handles losses
      // - capabilities: enable stripe_transfers so the account can receive payouts
      const account = await stripeClient.v2.core.accounts.create({
        display_name,
        contact_email,
        identity: { country: "us" },
        dashboard: "express",
        defaults: {
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
      });

      // Step 2: Store the mapping in our database
      const { error: insertError } = await supabase
        .from("connected_accounts")
        .insert({
          user_id: user.id,
          stripe_account_id: account.id,
          display_name,
          contact_email,
        });

      if (insertError) {
        console.error("DB insert error:", insertError);
      }

      return new Response(JSON.stringify({ account_id: account.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- ACTION: Get account status (always from Stripe API) ----
    if (req.method === "GET" && action === "status") {
      const stripeAccountId = url.searchParams.get("stripe_account_id");
      if (!stripeAccountId) {
        return new Response(
          JSON.stringify({ error: "stripe_account_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Retrieve account with expanded configuration and requirements
      const account = await stripeClient.v2.core.accounts.retrieve(
        stripeAccountId,
        { include: ["configuration.recipient", "requirements"] }
      );

      // Check if the account is ready to receive payments
      const readyToReceivePayments =
        account?.configuration?.recipient?.capabilities?.stripe_balance
          ?.stripe_transfers?.status === "active";

      // Check onboarding completion by looking at requirements
      const requirementsStatus =
        account.requirements?.summary?.minimum_deadline?.status;
      const onboardingComplete =
        requirementsStatus !== "currently_due" &&
        requirementsStatus !== "past_due";

      return new Response(
        JSON.stringify({
          account_id: account.id,
          ready_to_receive_payments: readyToReceivePayments,
          onboarding_complete: onboardingComplete,
          requirements_status: requirementsStatus || "none",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---- ACTION: List user's connected accounts ----
    if (req.method === "GET" && action === "list") {
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ accounts: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("stripe-connect-account error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
