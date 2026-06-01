// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const IONOS_API = "https://api.hosting.ionos.com/domains/v1";

function buildIonosKey(): string {
  const key = (Deno.env.get("IONOS_API_KEY") ?? "").trim();
  const prefix = (Deno.env.get("IONOS_API_PREFIX") ?? "").trim();
  if (!key) return "";
  if (key.includes(".")) return key;
  if (prefix) return `${prefix}.${key}`;
  return key;
}

const TLD_TRANSFER_CREDITS: Record<string, number> = {
  com: 15, "com.br": 25, net: 16, org: 16, dev: 18, app: 22,
  io: 50, ai: 80, co: 30, xyz: 8, tech: 20, store: 25, online: 18,
};
function tldOf(domain: string) {
  const parts = domain.toLowerCase().split(".");
  if (parts.length >= 3 && parts[parts.length - 2] === "com" && parts[parts.length - 1] === "br") return "com.br";
  return parts[parts.length - 1] ?? "com";
}

async function log(svc: any, userId: string, eventType: string, status: string, message: string, metadata: any = {}) {
  try {
    await svc.from("connector_activity_logs").insert({
      connector_slug: "ionos", user_id: userId, event_type: eventType,
      status, message, metadata,
    });
  } catch { /* never fail main flow on logging */ }
}

async function ionosFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const url = `${IONOS_API}${path}`;
  const headers = { "X-API-Key": apiKey, "Content-Type": "application/json", accept: "application/json", ...(init.headers ?? {}) };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

function mapIonosStatus(s: string): "pending" | "validating" | "transferring" | "completed" | "failed" {
  const x = (s ?? "").toLowerCase();
  if (x.includes("complete") || x.includes("success")) return "completed";
  if (x.includes("fail") || x.includes("error") || x.includes("reject")) return "failed";
  if (x.includes("valid") || x.includes("auth")) return "validating";
  if (x.includes("transfer") || x.includes("progress")) return "transferring";
  return "pending";
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
    const apiKey = buildIonosKey();

    // STATUS — list or refresh single
    if (action === "list") {
      const { data } = await svc.from("kubo_domain_transfers").select("*").eq("user_id", user.id).order("started_at", { ascending: false });
      return new Response(JSON.stringify({ transfers: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const id = String(body?.transfer_id ?? "");
      const { data: t } = await svc.from("kubo_domain_transfers").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!t) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Refresh from IONOS if we have a transfer id and key
      if (apiKey && t.ionos_transfer_id) {
        const r = await ionosFetch(apiKey, `/domainorders/${encodeURIComponent(t.ionos_transfer_id)}`);
        const ionosStatus = r.body?.status ?? r.body?.properties?.status ?? null;
        const mapped = ionosStatus ? mapIonosStatus(String(ionosStatus)) : t.status;
        const update: any = { status: mapped, status_message: typeof r.body === "string" ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200), updated_at: new Date().toISOString() };
        if (mapped === "completed") {
          update.completed_at = new Date().toISOString();
          // Activate domain
          if (t.domain_id) await svc.from("kubo_domains").update({ status: "active", ssl_status: "provisioning" }).eq("id", t.domain_id);
        }
        await svc.from("kubo_domain_transfers").update(update).eq("id", id);
        await log(svc, user.id, "transfer.status", r.ok ? "success" : "error", `IONOS status: ${ionosStatus ?? "unknown"} → ${mapped}`, { transfer_id: id, ionos_status: ionosStatus, http: r.status });
        const { data: fresh } = await svc.from("kubo_domain_transfers").select("*").eq("id", id).maybeSingle();
        return new Response(JSON.stringify({ transfer: fresh }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ transfer: t }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // START
    const domain = String(body?.domain ?? "").trim().toLowerCase();
    const auth_code = String(body?.auth_code ?? "").trim();
    const current_registrar = body?.current_registrar ?? null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || auth_code.length < 4) {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tld = tldOf(domain);
    const price = TLD_TRANSFER_CREDITS[tld] ?? 20;

    await log(svc, user.id, "transfer.start", "info", `Iniciando transferência de ${domain}`, { domain, tld, price });

    // Debit credits
    const idemp = `domain-transfer:${user.id}:${domain}`;
    const { data: deduct, error: de } = await svc.rpc("execute_atomic_credit_deduction", {
      _user_id: user.id, _amount: price, _reason: `domain_transfer:${domain}`,
      _category: "domain", _metadata: { domain, tld, kind: "transfer" }, _idempotency_key: idemp,
    });
    if (de) {
      const msg = (de as any)?.message ?? "credit_error";
      await log(svc, user.id, "transfer.start", "error", `Crédito falhou: ${msg}`, { domain, error: msg });
      return new Response(JSON.stringify({ error: msg }), { status: msg.includes("insufficient") ? 402 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let ionos_transfer_id: string | null = null;
    let status: "pending" | "validating" | "transferring" | "completed" | "failed" = "pending";
    let statusMessage: string | null = null;

    if (apiKey) {
      const r = await ionosFetch(apiKey, `/domainorders`, {
        method: "POST",
        body: JSON.stringify([{ domainName: domain, type: "transfer", authCode: auth_code, period: 1 }]),
      });
      if (r.ok) {
        const first = Array.isArray(r.body) ? r.body[0] : r.body;
        ionos_transfer_id = String(first?.id ?? first?.orderId ?? "");
        status = "transferring";
        statusMessage = "Transferência aceita pela IONOS";
        await log(svc, user.id, "transfer.ionos", "success", `IONOS aceitou transferência`, { domain, ionos_transfer_id, http: r.status });
      } else {
        status = "failed";
        statusMessage = `IONOS ${r.status}: ${typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 200)}`;
        await log(svc, user.id, "transfer.ionos", "error", `IONOS rejeitou: ${r.status}`, { domain, http: r.status, body: r.body });
      }
    } else {
      statusMessage = "IONOS_API_KEY não configurada — salvo localmente";
    }

    const { data: dom } = await svc.from("kubo_domains").insert({
      user_id: user.id, domain_name: domain, tld, source: "transfer",
      status: status === "completed" ? "active" : "pending", credits_spent: price,
    }).select().single();

    const { data: transfer, error: ie } = await svc.from("kubo_domain_transfers").insert({
      user_id: user.id, domain_id: dom?.id ?? null, domain_name: domain,
      auth_code, current_registrar, status, ionos_transfer_id, status_message: statusMessage,
    }).select().single();
    if (ie) return new Response(JSON.stringify({ error: ie.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ success: true, transfer, domain: dom, balance_after: (deduct as any)?.balance_after }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
