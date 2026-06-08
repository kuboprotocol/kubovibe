// ============================================================
// Edge Function: stripe-connect-account
// Purpose: Create and retrieve Stripe Connected Accounts (V1 API)
// ============================================================

import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders, sanitizeError } from "../_shared/cors.ts";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}
const stripeClient = new Stripe(stripeKey);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
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

    // ---- ACTION: Create a new Connected Account (V1 Express) ----
    if (req.method === "POST" && action === "create") {
      const { display_name, contact_email } = await req.json();

      if (!display_name || !contact_email) {
        return new Response(
          JSON.stringify({ error: "display_name and contact_email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create an Express connected account using V1 API
      const account = await stripeClient.accounts.create({
        type: "express",
        country: "BR",
        email: contact_email,
        business_profile: {
          name: display_name,
        },
        capabilities: {
          transfers: { requested: true },
        },
      });

      // Store the mapping in our database
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

    // ---- ACTION: Get account status ----
    if (req.method === "GET" && action === "status") {
      const stripeAccountId = url.searchParams.get("stripe_account_id");
      if (!stripeAccountId) {
        return new Response(
          JSON.stringify({ error: "stripe_account_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Retrieve the account using V1 API
      const account = await stripeClient.accounts.retrieve(stripeAccountId);

      // Check if the account can receive transfers
      const transfersCapability = account.capabilities?.transfers;
      const readyToReceivePayments = transfersCapability === "active";

      // Check onboarding completion by looking at requirements
      const hasCurrentlyDue = (account.requirements?.currently_due?.length ?? 0) > 0;
      const hasPastDue = (account.requirements?.past_due?.length ?? 0) > 0;
      const onboardingComplete = !hasCurrentlyDue && !hasPastDue;

      return new Response(
        JSON.stringify({
          account_id: account.id,
          ready_to_receive_payments: readyToReceivePayments,
          onboarding_complete: onboardingComplete,
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
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
    return new Response(JSON.stringify({ error: sanitizeError(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
