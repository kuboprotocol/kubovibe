// ============================================================
// Edge Function: stripe-connect-webhook
// Purpose: Handle Stripe V2 "thin" webhook events for account
//          requirements changes and capability status updates
// ============================================================
// 
// SETUP INSTRUCTIONS:
// 1. Go to Stripe Dashboard → Developers → Webhooks → + Add destination
// 2. In "Events from" section, select "Connected accounts"
// 3. Click "Show advanced options" → Payload style: select "Thin"
// 4. Search for "v2" events and select:
//    - v2.account[requirements].updated
//    - v2.account[configuration.recipient].capability_status_updated
// 5. Set the endpoint URL to:
//    https://dlqmmubasyldcylhnqqd.supabase.co/functions/v1/stripe-connect-webhook
// 6. Copy the signing secret and save it as STRIPE_WEBHOOK_SECRET
//
// LOCAL TESTING with Stripe CLI:
// stripe listen --thin-events \
//   'v2.core.account[requirements].updated,v2.core.account[.recipient].capability_status_updated' \
//   --forward-thin-to http://localhost:54321/functions/v1/stripe-connect-webhook
// ============================================================

import Stripe from "npm:stripe@^18";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY.");
const stripeClient = new Stripe(stripeKey);

// PLACEHOLDER: Set STRIPE_WEBHOOK_SECRET in your project secrets
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
if (!webhookSecret) {
  throw new Error(
    "Missing STRIPE_WEBHOOK_SECRET. Add it after configuring the webhook in Stripe Dashboard."
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Step 1: Get the raw body and signature header
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Step 2: Parse the thin event using Stripe SDK
    // Thin events contain only event metadata, not the full object
    // You must fetch the full event data separately
    const thinEvent = stripeClient.parseThinEvent(body, sig, webhookSecret);

    console.log(`Received thin event: ${thinEvent.type} (${thinEvent.id})`);

    // Step 3: Fetch the full event data from Stripe
    const event = await stripeClient.v2.core.events.retrieve(thinEvent.id);

    // Step 4: Handle each event type
    switch (event.type) {
      case "v2.core.account.requirements.updated": {
        // Account requirements have changed (e.g., new KYC docs needed)
        // In production, you would:
        // - Notify the connected account owner
        // - Update your database with new requirement status
        // - Prompt re-onboarding if needed
        console.log(
          `Requirements updated for account. Event data:`,
          JSON.stringify(event.data)
        );
        break;
      }

      case "v2.core.account.configuration.recipient.capability_status_updated": {
        // A capability status changed (e.g., transfers activated/deactivated)
        // In production, you would:
        // - Update the account status in your database
        // - Enable/disable features based on capability status
        console.log(
          `Capability status updated. Event data:`,
          JSON.stringify(event.data)
        );
        break;
      }

      default: {
        console.log(`Unhandled event type: ${event.type}`);
      }
    }

    // Always return 200 to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    // Return 400 for signature verification failures
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
