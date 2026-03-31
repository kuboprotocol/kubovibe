// ============================================================
// Edge Function: stripe-connect-products
// Purpose: Create and list platform-level Stripe products
//          mapped to connected accounts
// ============================================================

import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY.");
const stripeClient = new Stripe(stripeKey);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ---- LIST products (public, no auth required) ----
    if (req.method === "GET") {
      // Fetch all products from our database (storefront view)
      const { data, error } = await supabase
        .from("connect_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ products: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CREATE product (auth required) ----
    if (req.method === "POST") {
      // Authenticate user
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      const { name, description, price_cents, currency, connected_account_id } =
        await req.json();

      // Validate required fields
      if (!name || !price_cents || !connected_account_id) {
        return new Response(
          JSON.stringify({
            error: "name, price_cents, and connected_account_id are required",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Create the product on Stripe at the PLATFORM level
      // Products are owned by the platform, not the connected account
      // We store the connected_account_id in metadata for routing payments later
      const product = await stripeClient.products.create({
        name,
        description: description || undefined,
        default_price_data: {
          unit_amount: price_cents,
          currency: currency || "usd",
        },
        metadata: {
          connected_account_id,
        },
      });

      // Step 2: Store the product in our database for the storefront
      const { error: insertError } = await supabase
        .from("connect_products")
        .insert({
          stripe_product_id: product.id,
          stripe_price_id:
            typeof product.default_price === "string"
              ? product.default_price
              : product.default_price?.id,
          connected_account_id,
          name,
          description: description || null,
          price_cents,
          currency: currency || "usd",
          created_by: user.id,
        });

      if (insertError) {
        console.error("DB insert error:", insertError);
        throw insertError;
      }

      return new Response(
        JSON.stringify({
          product_id: product.id,
          price_id: product.default_price,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("stripe-connect-products error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
