// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const IONOS_API = "https://api.hosting.ionos.com/domains/v1";
const TLD_TRANSFER_CREDITS: Record<string, number> = {
  com: 15, "com.br": 25, net: 16, org: 16, dev: 18, app: 22,
  io: 50, ai: 80, co: 30, xyz: 8, tech: 20, store: 25, online: 18,
};
function tldOf(domain: string) {
  const parts = domain.toLowerCase().split(".");
  if (parts.length >= 3 && parts[parts.length - 2] === "com" && parts[parts.length - 1] === "br") return "com.br";
  return parts[parts.length - 1] ?? "com";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userRes, error: ue } = await userClient.auth.getUser();
    if (ue || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "start");
    const apiKey = Deno.env.get("IONOS_API_KEY") ?? "";

    if (action === "status") {
      const id = String(body?.transfer_id ?? "");
      const { data: t } = await svc.from("kubo_domain_transfers").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!t) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      // optional: poll IONOS
      return new Response(JSON.stringify({ transfer: t }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // start
    const domain = String(body?.domain ?? "").trim().toLowerCase();
    const auth_code = String(body?.auth_code ?? "").trim();
    const current_registrar = body?.current_registrar ?? null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || auth_code.length < 4) {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tld = tldOf(domain);
    const price = TLD_TRANSFER_CREDITS[tld] ?? 20;

    // Debit credits
    const idemp = `domain-transfer:${user.id}:${domain}`;
    const { data: deduct, error: de } = await svc.rpc("execute_atomic_credit_deduction", {
      _user_id: user.id, _amount: price, _reason: `domain_transfer:${domain}`,
      _category: "domain", _metadata: { domain, tld, kind: "transfer" }, _idempotency_key: idemp,
    });
    if (de) {
      const msg = (de as any)?.message ?? "credit_error";
      return new Response(JSON.stringify({ error: msg }), { status: msg.includes("insufficient") ? 402 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let ionos_transfer_id: string | null = null;
    let status: "pending" | "validating" | "transferring" | "completed" | "failed" = "pending";
    if (apiKey) {
      try {
        const r = await fetch(`${IONOS_API}/domainorders`, {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ properties: { name: domain, action: "transfer", authCode: auth_code, autoRenewal: true } }),
        });
        if (r.ok) {
          const d = await r.json();
          ionos_transfer_id = String(d?.id ?? "");
          status = "transferring";
        } else { status = "failed"; }
      } catch { status = "failed"; }
    }

    const { data: dom } = await svc.from("kubo_domains").insert({
      user_id: user.id, domain_name: domain, tld, source: "transfer",
      status: status === "completed" ? "active" : "pending", credits_spent: price,
    }).select().single();

    const { data: transfer, error: ie } = await svc.from("kubo_domain_transfers").insert({
      user_id: user.id, domain_id: dom?.id ?? null, domain_name: domain,
      auth_code, current_registrar, status, ionos_transfer_id,
      status_message: apiKey ? null : "IONOS_API_KEY not configured — saved locally",
    }).select().single();
    if (ie) return new Response(JSON.stringify({ error: ie.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ success: true, transfer, domain: dom, balance_after: (deduct as any)?.balance_after }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
