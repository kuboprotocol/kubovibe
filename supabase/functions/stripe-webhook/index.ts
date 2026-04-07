import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_CREDITS: Record<string, number> = {
  starter: 35,
  basic: 80,
  pro: 120,
  advanced: 200,
  elite: 350,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey || !webhookSecret) {
      console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey);
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.user_id || session.client_reference_id;
      const planId = session.metadata?.plan_id;
      const creditsFromMeta = session.metadata?.credits
        ? parseInt(session.metadata.credits, 10)
        : null;

      if (!userId || !planId) {
        console.error("Missing user_id or plan_id in session metadata", session.id);
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const credits = creditsFromMeta || PLAN_CREDITS[planId] || 0;

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Check if user already has a subscription
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id, edits_limit, edits_used")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        // Add credits to existing subscription
        const newLimit = existing.edits_limit + credits;
        const { error: updateErr } = await supabase
          .from("subscriptions")
          .update({
            plan: planId,
            edits_limit: newLimit,
            is_active: true,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateErr) {
          console.error("Error updating subscription:", updateErr);
        } else {
          console.log(`✅ Credited ${credits} to user ${userId} (total limit: ${newLimit})`);
        }
      } else {
        // Create new subscription
        const { error: insertErr } = await supabase
          .from("subscriptions")
          .insert({
            user_id: userId,
            plan: planId,
            edits_used: 0,
            edits_limit: credits,
            is_active: true,
            paid_at: new Date().toISOString(),
          });

        if (insertErr) {
          console.error("Error creating subscription:", insertErr);
        } else {
          console.log(`✅ Created subscription for user ${userId} with ${credits} credits`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("stripe-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
