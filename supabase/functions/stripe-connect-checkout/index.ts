// ============================================================
// Edge Function: stripe-connect-checkout
// Purpose: Create a Stripe Checkout Session using Destination Charges
//          with an application fee for platform monetization
// ============================================================

import Stripe from "npm:stripe@^18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY.");
const stripeClient = new Stripe(stripeKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      product_name,
      price_cents,
      currency,
      connected_account_id,
      quantity,
      success_url,
      cancel_url,
    } = await req.json();

    // Validate all required fields
    if (!product_name || !price_cents || !connected_account_id) {
      return new Response(
        JSON.stringify({
          error: "product_name, price_cents, and connected_account_id required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate the application fee (platform's cut)
    // Here we take 10% of the transaction as the platform fee
    const applicationFee = Math.round(price_cents * 0.1);

    // Create a Checkout Session with Destination Charges
    // - line_items: what the customer is buying
    // - payment_intent_data.transfer_data.destination: routes funds to connected account
    // - payment_intent_data.application_fee_amount: platform's revenue per transaction
    // - mode: 'payment' for one-time charges
    const session = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: currency || "usd",
            product_data: { name: product_name },
            unit_amount: price_cents,
          },
          quantity: quantity || 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: connected_account_id,
        },
      },
      mode: "payment",
      success_url:
        success_url ||
        "https://kubovibe.lovable.app/connect?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url:
        cancel_url || "https://kubovibe.lovable.app/connect?checkout=cancelled",
    });

    return new Response(JSON.stringify({ checkout_url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("stripe-connect-checkout error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
