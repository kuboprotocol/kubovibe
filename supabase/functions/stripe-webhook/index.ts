import { createClient } from "npm:@supabase/supabase-js@^2";
import Stripe from "npm:stripe@^14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature" };
const BUSINESS_PLANS = ["business_1","business_2","business_3","business_4","business_5","business_6","business_7","enterprise"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;
      const period = session.metadata?.period;

      // Prepaid credit top-up: add balance to the buyer's ledger, exactly once.
      if (session.metadata?.kind === "credit_topup") {
        const orderId = session.metadata?.order_id;
        const credits = Number(session.metadata?.credits ?? 0);
        if (!userId || !orderId || !Number.isInteger(credits) || credits <= 0) {
          return new Response("Missing topup metadata", { status: 400 });
        }
        const { error: topupError } = await supabase.rpc("execute_atomic_credit_topup", {
          _user_id: userId,
          _amount: credits,
          _reason: "credit_purchase",
          _category: "billing",
          _metadata: { order_id: orderId, stripe_session_id: session.id },
          _idempotency_key: `credit_order:${orderId}`,
        });
        await supabase.from("credit_orders").update({
          status: topupError ? "failed" : "paid",
          credited_at: topupError ? null : new Date().toISOString(),
          metadata: topupError ? { error: topupError.message } : {},
        }).eq("id", orderId);
        if (topupError) {
          console.error("credit topup failed:", topupError);
          return new Response("Topup failed", { status: 500 });
        }
        console.log(`✅ Credit top-up: ${credits} credits for user ${userId}`);
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (!userId || !plan) return new Response("Missing metadata", { status: 400 });


      const now = new Date().toISOString();
      const { data: existingSub } = await supabase.from("subscriptions").select("id").eq("user_id", userId).maybeSingle();
      const subPayload: any = { plan, is_active: true, paid_at: now, stripe_session_id: session.id, stripe_subscription_id: (session.subscription as string) || null, updated_at: now };

      if (existingSub) {
        await supabase.from("subscriptions").update(subPayload).eq("id", existingSub.id);
      } else {
        await supabase.from("subscriptions").insert({ user_id: userId, edits_used: 0, edits_limit: 0, ...subPayload });
      }

      if (BUSINESS_PLANS.includes(plan)) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-partnership-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "x-user-id": userId },
          });
        } catch (e) { console.warn("partnership email failed:", e); }
      }
      console.log(`✅ Plan activated: ${plan} (${period}) for user ${userId}`);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.supabase_user_id;
      if (userId) {
        await supabase.from("subscriptions").update({ plan: "free", is_active: false, stripe_subscription_id: null, updated_at: new Date().toISOString() } as any).eq("user_id", userId);
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as any).subscription as string;
      if (subId) {
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        const userId = stripeSub.metadata?.supabase_user_id;
        if (userId) {
          await supabase.from("subscriptions").update({ is_active: true, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any).eq("user_id", userId);
        }
      }
    }
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
