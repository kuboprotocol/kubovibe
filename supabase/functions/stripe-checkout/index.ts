import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { name: string; credits: number; priceUsd: number }> = {
  starter:  { name: "Starter",  credits: 35,  priceUsd: 4.99 },
  basic:    { name: "Basic",    credits: 80,  priceUsd: 19.99 },
  pro:      { name: "Pro",      credits: 120, priceUsd: 39.99 },
  advanced: { name: "Advanced", credits: 200, priceUsd: 59.99 },
  elite:    { name: "Elite",    credits: 350, priceUsd: 99.99 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_id } = await req.json();
    const plan = PLANS[plan_id];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid plan_id. Valid: " + Object.keys(PLANS).join(", ") }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Kubo Vibe — ${plan.name} (${plan.credits} credits)`,
            description: `${plan.credits} AI credits for Kubo Vibe Builder`,
          },
          unit_amount: Math.round(plan.priceUsd * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `https://kubovibe.lovable.app/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://kubovibe.lovable.app/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan_id,
        credits: String(plan.credits),
      },
    });

    return new Response(JSON.stringify({ checkout_url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("stripe-checkout error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
