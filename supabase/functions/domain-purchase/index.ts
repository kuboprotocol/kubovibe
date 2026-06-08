// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, sanitizeError } from "../_shared/cors.ts";

const IONOS_API = "https://api.hosting.ionos.com/domains/v1";
const RESELLER_API = "https://api.ionos.com/reseller/v2";

function buildIonosKey(): string {
  const key = (Deno.env.get("IONOS_API_KEY") ?? "").trim();
  const prefix = (Deno.env.get("IONOS_API_PREFIX") ?? "").trim();
  if (!key) return "";
  if (key.includes(".")) return key;
  if (prefix) return `${prefix}.${key}`;
  return key;
}
const PLAN_LIMITS: Record<string, any> = {
  starter: { ramServerMax: 2, cpuServerMax: 1, ips: 1 },
  pro: { ramServerMax: 8, cpuServerMax: 4, ips: 2 },
  enterprise: { ramServerMax: 32, cpuServerMax: 16, ips: 10 },
};
const TLD_PRICES: Record<string, number> = {
  com: 15, "com.br": 25, net: 16, org: 16, dev: 18, app: 22,
  io: 50, ai: 80, co: 30, xyz: 8, tech: 20, store: 25, online: 18,
};

function tldOf(domain: string) {
  const parts = domain.toLowerCase().split(".");
  if (parts.length >= 3 && parts[parts.length - 2] === "com" && parts[parts.length - 1] === "br") return "com.br";
  return parts[parts.length - 1] ?? "com";
}

async function getOrCreateContract(svc: any, userId: string, email: string, apiKey: string) {
  const { data: existing } = await svc.from("kubo_ionos_contracts").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing;

  const reseller_reference = `kubo_${userId.slice(0, 8)}`;
  let contract_id = `local_${userId.slice(0, 8)}`;
  let admin_id: string | null = null;

  if (apiKey) {
    try {
      const r = await fetch(`${RESELLER_API}/contracts`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Kubo ${email}`,
          resellerReference: reseller_reference,
          resourceLimits: PLAN_LIMITS.starter,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        contract_id = String(d?.id ?? contract_id);
        // Try admin creation but don't fail purchase if it errors
        try {
          const ar = await fetch(`${RESELLER_API}/contracts/${contract_id}/admins`, {
            method: "POST",
            headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: "Kubo",
              lastName: email.split("@")[0] ?? "User",
              email,
              password: crypto.randomUUID() + "Aa1!",
            }),
          });
          if (ar.ok) admin_id = String((await ar.json())?.id ?? null);
        } catch { /* ignore */ }
      }
    } catch { /* fallback to local id */ }
  }

  const { data: inserted, error } = await svc.from("kubo_ionos_contracts").insert({
    user_id: userId, contract_id, admin_id, reseller_reference,
    plan: "starter", resource_limits: PLAN_LIMITS.starter,
  }).select().single();
  if (error) throw error;
  return inserted;
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
    const domain = String(body?.domain ?? "").trim().toLowerCase();
    const project_id = body?.project_id ?? null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
      return new Response(JSON.stringify({ error: "invalid_domain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tld = tldOf(domain);
    const price = TLD_PRICES[tld] ?? 20;

    // 1) Debit credits atomically
    const idemp = `domain-purchase:${user.id}:${domain}`;
    const { data: deduct, error: de } = await svc.rpc("execute_atomic_credit_deduction", {
      _user_id: user.id,
      _amount: price,
      _reason: `domain_purchase:${domain}`,
      _category: "domain",
      _metadata: { domain, tld },
      _idempotency_key: idemp,
    });
    if (de) {
      const msg = (de as any)?.message ?? "credit_error";
      const code = msg.includes("insufficient") ? 402 : 400;
      return new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Ensure IONOS contract
    const apiKey = buildIonosKey();
    const contract = await getOrCreateContract(svc, user.id, user.email ?? `${user.id}@kubo.local`, apiKey);

    // 3) Place order on IONOS (best effort)
    let ionos_domain_id: string | null = null;
    let status = apiKey ? "processing" : "pending";
    let ionosResponseBody: any = null;
    let ionosHttpStatus: number | null = null;
    if (apiKey) {
      try {
        const r = await fetch(`${IONOS_API}/domainorders`, {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify([{ domainName: domain, period: 1, autoRenewal: true }]),
        });
        ionosHttpStatus = r.status;
        const text = await r.text();
        try { ionosResponseBody = JSON.parse(text); } catch { ionosResponseBody = text; }
        if (r.ok) {
          const first = Array.isArray(ionosResponseBody) ? ionosResponseBody[0] : ionosResponseBody;
          ionos_domain_id = String(first?.id ?? first?.orderId ?? "");
          status = "active";
        } else {
          status = "failed";
        }
      } catch (e: any) {
        status = "failed";
        ionosResponseBody = { error: e?.message };
      }
    }

    // Log
    try {
      await svc.from("connector_activity_logs").insert({
        connector_slug: "ionos", user_id: user.id, event_type: "purchase",
        status: status === "failed" ? "error" : "success",
        message: `Compra ${domain} (${price}c) → ${status}`,
        metadata: { domain, tld, price, status, ionos_domain_id, http: ionosHttpStatus, ionos_body: ionosResponseBody },
      });
    } catch { /* ignore */ }

    // 4) Persist domain
    const { data: dom, error: ie } = await svc.from("kubo_domains").insert({
      user_id: user.id,
      contract_id: contract.contract_id,
      ionos_domain_id,
      domain_name: domain,
      tld,
      source: "purchase",
      status,
      project_id,
      credits_spent: price,
      ssl_status: status === "active" ? "provisioning" : "pending",
      metadata: { credit_tx: deduct },
    }).select().single();
    if (ie) {
      return new Response(JSON.stringify({ error: sanitizeError(ie), refund_required: true, deduct }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, domain: dom, contract, balance_after: (deduct as any)?.balance_after }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[domain-purchase] error:", e);
    return new Response(JSON.stringify({ error: sanitizeError(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
