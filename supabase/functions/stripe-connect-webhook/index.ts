// ============================================================
// Edge Function: stripe-connect-webhook
// Purpose: Handle Stripe Connect webhook events (V1 API)
// ============================================================
//
// SETUP INSTRUCTIONS:
// 1. Go to Stripe Dashboard → Developers → Webhooks → + Add destination
// 2. In "Events from" section, select "Connected accounts"
// 3. Select events: account.updated, checkout.session.completed
// 4. Set the endpoint URL to:
//    https://dlqmmubasyldcylhnqqd.supabase.co/functions/v1/stripe-connect-webhook
// 5. Copy the signing secret and save it as STRIPE_WEBHOOK_SECRET
// ============================================================

import Stripe from "npm:stripe@^18";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY.");
const stripeClient = new Stripe(stripeKey);

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
if (!webhookSecret) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Verify the webhook signature
    const event = stripeClient.webhooks.constructEvent(body, sig, webhookSecret);

    console.log(`Received event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        console.log(`Account ${account.id} updated.`);
        console.log(`  charges_enabled: ${account.charges_enabled}`);
        console.log(`  payouts_enabled: ${account.payouts_enabled}`);
        console.log(`  details_submitted: ${account.details_submitted}`);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(`Checkout session ${session.id} completed.`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
