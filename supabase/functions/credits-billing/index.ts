// KUBO prepaid credit billing.
// Admins define packages and the per-credit price; teams pay before the balance is usable.
import Stripe from "npm:stripe@^14";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, supaAdmin, sanitizeError } from "../_shared/creative.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" });
const SITE_URL = Deno.env.get("SITE_URL") || "https://kubovibe.dev";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function positiveInt(value: unknown, max = 10_000_000): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > max) return null;
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUser(req.headers.get("Authorization"));
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = supaAdmin();
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = String((body as any).action ?? "config");

    const { data: isAdmin } = await admin.rpc("is_admin", { p_user_id: user.id });

    // ---------- public config ----------
    if (action === "config") {
      const [{ data: packages }, { data: settings }, { data: orders }] = await Promise.all([
        admin.from("credit_packages").select("*").order("sort_order", { ascending: true }),
        admin.from("billing_settings").select("*").eq("id", true).maybeSingle(),
        admin.from("credit_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      return json({
        packages: (packages ?? []).filter((p: any) => isAdmin || p.active),
        settings,
        orders: orders ?? [],
        is_admin: !!isAdmin,
      });
    }

    // ---------- admin: all orders ----------
    if (action === "orders") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const { data, error } = await admin
        .from("credit_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ orders: data ?? [] });
    }

    // ---------- admin: save package ----------
    if (action === "save_package") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const name = String((body as any).name ?? "").trim().slice(0, 80);
      const credits = positiveInt((body as any).credits);
      const priceCents = positiveInt((body as any).price_cents);
      if (!name || !credits || !priceCents) return json({ error: "invalid_package" }, 400);
      const payload = {
        name,
        credits,
        price_cents: priceCents,
        currency: String((body as any).currency ?? "usd").slice(0, 3).toLowerCase(),
        active: (body as any).active !== false,
        sort_order: Number((body as any).sort_order ?? 0) || 0,
        updated_at: new Date().toISOString(),
      };
      const id = (body as any).id;
      const query = id
        ? admin.from("credit_packages").update(payload).eq("id", id).select().single()
        : admin.from("credit_packages").insert(payload).select().single();
      const { data, error } = await query;
      if (error) throw error;
      return json({ package: data });
    }

    // ---------- admin: delete package ----------
    if (action === "delete_package") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const id = String((body as any).id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      const { error } = await admin.from("credit_packages").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- admin: settings ----------
    if (action === "save_settings") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const pricePerCredit = positiveInt((body as any).price_per_credit_cents, 100_000);
      const minCredits = positiveInt((body as any).min_credits);
      const maxCredits = positiveInt((body as any).max_credits);
      if (!pricePerCredit || !minCredits || !maxCredits || maxCredits < minCredits) {
        return json({ error: "invalid_settings" }, 400);
      }
      const { data, error } = await admin
        .from("billing_settings")
        .update({
          price_per_credit_cents: pricePerCredit,
          min_credits: minCredits,
          max_credits: maxCredits,
          currency: String((body as any).currency ?? "usd").slice(0, 3).toLowerCase(),
          custom_amount_enabled: (body as any).custom_amount_enabled !== false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true)
        .select()
        .single();
      if (error) throw error;
      return json({ settings: data });
    }

    // ---------- checkout (package or custom quantity) ----------
    if (action === "checkout") {
      if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ error: "stripe_not_configured" }, 503);

      const packageId = (body as any).package_id ? String((body as any).package_id) : null;
      let credits: number;
      let amountCents: number;
      let currency = "usd";
      let label = "KUBO credits";

      if (packageId) {
        const { data: pack } = await admin.from("credit_packages").select("*").eq("id", packageId).eq("active", true).maybeSingle();
        if (!pack) return json({ error: "package_not_found" }, 404);
        credits = pack.credits;
        amountCents = pack.price_cents;
        currency = pack.currency;
        label = `KUBO — ${pack.name} (${pack.credits} credits)`;
      } else {
        const { data: settings } = await admin.from("billing_settings").select("*").eq("id", true).maybeSingle();
        if (!settings?.custom_amount_enabled) return json({ error: "custom_amount_disabled" }, 400);
        const qty = positiveInt((body as any).credits);
        if (!qty || qty < settings.min_credits || qty > settings.max_credits) {
          return json({ error: "invalid_credits", min: settings.min_credits, max: settings.max_credits }, 400);
        }
        credits = qty;
        amountCents = qty * settings.price_per_credit_cents;
        currency = settings.currency;
        label = `KUBO — ${qty} credits`;
      }

      const { data: order, error: orderError } = await admin
        .from("credit_orders")
        .insert({
          user_id: user.id,
          package_id: packageId,
          credits,
          amount_cents: amountCents,
          currency,
          status: "pending",
          metadata: { label },
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email ?? undefined,
        line_items: [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: { name: label },
          },
        }],
        metadata: {
          kind: "credit_topup",
          supabase_user_id: user.id,
          order_id: order.id,
          credits: String(credits),
        },
        success_url: `${SITE_URL}/pricing?topup=success&order=${order.id}`,
        cancel_url: `${SITE_URL}/pricing?topup=cancelled`,
      });

      await admin.from("credit_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
      return json({ url: session.url, order_id: order.id });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[credits-billing]", err);
    return json({ error: sanitizeError(err) }, 500);
  }
});
