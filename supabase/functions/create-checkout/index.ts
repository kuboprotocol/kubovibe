import { createClient } from "npm:@supabase/supabase-js@^2";
import Stripe from "npm:stripe@^14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

// Somente planos até US$ 49,99/mês estão à venda. Premium 2 e Business 1–7
// saíram da venda: pedidos desses planos caem em "Unknown plan" (400).
// Assinaturas já existentes continuam valendo (stripe-webhook e planConfig
// ainda conhecem esses planos).
const PLAN_PRICES: Record<string, { monthly: number; annual: number; lifetime: number; name: string }> = {
  starter:    { monthly: 499,   annual: 4790,   lifetime: 2994,   name: "KUBO Vibe — Starter"    },
  pro:        { monthly: 1999,  annual: 19190,  lifetime: 11994,  name: "KUBO Vibe — Pro"        },
  premium_1:  { monthly: 4999,  annual: 47990,  lifetime: 29994,  name: "KUBO Vibe — Premium 1"  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { plan, period } = await req.json() as { plan: string; period: "monthly" | "annual" | "lifetime" };
    if (!plan || !period) return new Response(JSON.stringify({ error: "Missing plan or period" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const planConfig = PLAN_PRICES[plan];
    if (!planConfig) return new Response(JSON.stringify({ error: `Unknown plan: ${plan}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id, display_name").eq("id", user.id).maybeSingle();

    let customerId = (profile as any)?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email!, name: (profile as any)?.display_name || user.email, metadata: { supabase_user_id: user.id, plan } });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId } as any).eq("id", user.id);
    }

    const isRecurring = period !== "lifetime";
    const price = await stripe.prices.create({
      unit_amount: planConfig[period],
      currency: "usd",
      ...(isRecurring ? { recurring: { interval: period === "monthly" ? "month" : "year" } } : {}),
      product_data: { name: planConfig.name, metadata: { plan, period } },
    });

    const SITE_URL = Deno.env.get("SITE_URL") || "https://kubovibe.dev";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: price.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      locale: "auto",
      allow_promotion_codes: true,
      metadata: { supabase_user_id: user.id, plan, period },
      ...(isRecurring ? { subscription_data: { metadata: { supabase_user_id: user.id, plan, period } } } : {}),
      success_url: `${SITE_URL}/dashboard?checkout=success&plan=${plan}&period=${period}`,
      cancel_url: `${SITE_URL}/pricing?checkout=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("create-checkout error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
