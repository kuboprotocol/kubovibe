// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const IONOS_API = "https://api.hosting.ionos.com/domains/v1";
const MAX_RETRIES = 8;
// Exponential backoff in minutes: 1, 2, 5, 10, 20, 40, 80, 160
const BACKOFF_MIN = [1, 2, 5, 10, 20, 40, 80, 160];

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

async function logConn(svc: any, userId: string, eventType: string, status: string, message: string, metadata: any = {}) {
  try {
    await svc.from("connector_activity_logs").insert({
      connector_slug: "ionos", user_id: userId, event_type: eventType, status, message, metadata,
    });
  } catch { /* ignore */ }
}

async function logEvent(svc: any, transferId: string, userId: string, eventType: string, fromStatus: string | null, toStatus: string | null, message: string | null, metadata: any = {}) {
  try {
    await svc.from("kubo_domain_transfer_events").insert({
      transfer_id: transferId, user_id: userId, event_type: eventType,
      from_status: fromStatus, to_status: toStatus, message, metadata,
    });
  } catch { /* ignore */ }
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

function nextBackoff(retryCount: number): Date {
  const min = BACKOFF_MIN[Math.min(retryCount, BACKOFF_MIN.length - 1)];
  return new Date(Date.now() + min * 60_000);
}

async function notifyStatus(svc: any, t: any, status: string, message: string | null) {
  if (!t.notify_email || t.last_notified_status === status) return;
  try {
    await svc.functions.invoke("send-transactional-email", {
      body: {
        templateName: "domain-transfer-status",
        recipientEmail: t.notify_email,
        idempotencyKey: `transfer-${t.id}-${status}`,
        templateData: { domain: t.domain_name, status, message: message ?? "", registrar: t.current_registrar ?? "" },
      },
    });
    await svc.from("kubo_domain_transfers").update({ last_notified_status: status }).eq("id", t.id);
  } catch (e) {
    await logConn(svc, t.user_id, "transfer.notify_error", "error", `Falha ao enviar email: ${(e as any)?.message ?? e}`, { transfer_id: t.id });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "start");

    // Cron-mode: scheduled batch poll (no user JWT)
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = action === "cron_poll" && cronSecret && cronSecret === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let user: any = null;
    if (!isCron) {
      const auth = req.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: userRes, error: ue } = await userClient.auth.getUser();
      if (ue || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      user = userRes.user;
    }

    const apiKey = buildIonosKey();

    // ============================ CRON POLL ============================
    if (isCron) {
      const now = new Date().toISOString();
      const { data: due } = await svc.from("kubo_domain_transfers")
        .select("*")
        .in("status", ["pending", "validating", "transferring"])
        .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
        .limit(25);

      const results: any[] = [];
      for (const t of (due ?? [])) {
        const r = await pollTransfer(svc, t, apiKey);
        results.push({ id: t.id, ...r });
      }
      return new Response(JSON.stringify({ polled: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================ LIST ============================
    if (action === "list") {
      const { data } = await svc.from("kubo_domain_transfers").select("*").eq("user_id", user.id).order("started_at", { ascending: false });
      return new Response(JSON.stringify({ transfers: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================ EVENTS (audit history) ============================
    if (action === "events") {
      const transferId = String(body?.transfer_id ?? "");
      const { data } = await svc.from("kubo_domain_transfer_events")
        .select("*").eq("user_id", user.id).eq("transfer_id", transferId)
        .order("created_at", { ascending: false }).limit(100);
      return new Response(JSON.stringify({ events: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================ STATUS (manual) ============================
    if (action === "status") {
      const id = String(body?.transfer_id ?? "");
      const { data: t } = await svc.from("kubo_domain_transfers").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!t) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const r = await pollTransfer(svc, t, apiKey);
      const { data: fresh } = await svc.from("kubo_domain_transfers").select("*").eq("id", id).maybeSingle();
      return new Response(JSON.stringify({ transfer: fresh, poll: r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================ CANCEL ============================
    if (action === "cancel") {
      const id = String(body?.transfer_id ?? "");
      const reason = String(body?.reason ?? "Cancelado pelo usuário").slice(0, 500);
      const { data: t } = await svc.from("kubo_domain_transfers").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!t) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (["completed", "failed", "cancelled"].includes(t.status)) {
        return new Response(JSON.stringify({ error: "transfer_not_cancellable", status: t.status }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Try IONOS cancel (best effort)
      let ionosOk = false;
      let ionosMsg = "Cancelado localmente (IONOS não chamada)";
      if (apiKey && t.ionos_transfer_id) {
        const r = await ionosFetch(apiKey, `/domainorders/${encodeURIComponent(t.ionos_transfer_id)}?cancelImmediately=true`, { method: "DELETE" });
        ionosOk = r.ok;
        ionosMsg = ionosOk ? "IONOS aceitou cancelamento" : `IONOS ${r.status}: ${typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 200)}`;
        await logConn(svc, user.id, "transfer.cancel.ionos", ionosOk ? "success" : "warning", ionosMsg, { transfer_id: id, http: r.status });
      }

      await svc.from("kubo_domain_transfers").update({
        status: "cancelled", cancel_requested_at: new Date().toISOString(),
        cancel_reason: reason, status_message: ionosMsg, next_retry_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);

      if (t.domain_id) await svc.from("kubo_domains").update({ status: "cancelled" }).eq("id", t.domain_id);

      await logEvent(svc, id, user.id, "cancelled", t.status, "cancelled", reason, { ionos_ok: ionosOk, ionos_msg: ionosMsg });
      await logConn(svc, user.id, "transfer.cancel", "info", `Transferência ${t.domain_name} cancelada`, { transfer_id: id, reason });

      const { data: fresh } = await svc.from("kubo_domain_transfers").select("*").eq("id", id).maybeSingle();
      if (fresh) await notifyStatus(svc, fresh, "cancelled", reason);

      return new Response(JSON.stringify({ success: true, transfer: fresh }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================ START ============================
    const domain = String(body?.domain ?? "").trim().toLowerCase();
    const auth_code = String(body?.auth_code ?? "").trim();
    const current_registrar = body?.current_registrar ?? null;
    const notify_email = String(body?.notify_email ?? user.email ?? "").trim() || null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || auth_code.length < 4) {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tld = tldOf(domain);
    const price = TLD_TRANSFER_CREDITS[tld] ?? 20;

    await logConn(svc, user.id, "transfer.start", "info", `Iniciando transferência de ${domain}`, { domain, tld, price });

    const idemp = `domain-transfer:${user.id}:${domain}`;
    const { data: deduct, error: de } = await svc.rpc("execute_atomic_credit_deduction", {
      _user_id: user.id, _amount: price, _reason: `domain_transfer:${domain}`,
      _category: "domain", _metadata: { domain, tld, kind: "transfer" }, _idempotency_key: idemp,
    });
    if (de) {
      const msg = (de as any)?.message ?? "credit_error";
      await logConn(svc, user.id, "transfer.start", "error", `Crédito falhou: ${msg}`, { domain, error: msg });
      return new Response(JSON.stringify({ error: msg }), { status: msg.includes("insufficient") ? 402 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let ionos_transfer_id: string | null = null;
    let status: "pending" | "validating" | "transferring" | "completed" | "failed" = "pending";
    let statusMessage: string | null = null;
    let last_error: string | null = null;

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
        await logConn(svc, user.id, "transfer.ionos", "success", `IONOS aceitou`, { domain, ionos_transfer_id, http: r.status });
      } else {
        status = "pending";
        last_error = `IONOS ${r.status}: ${typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 200)}`;
        statusMessage = `Aguardando retry — ${last_error}`;
        await logConn(svc, user.id, "transfer.ionos", "warning", `IONOS retornou ${r.status}, retry agendado`, { domain, http: r.status, body: r.body });
      }
    } else {
      statusMessage = "IONOS_API_KEY não configurada — salvo localmente";
    }

    const { data: dom } = await svc.from("kubo_domains").insert({
      user_id: user.id, domain_name: domain, tld, source: "transfer",
      status: status === "completed" ? "active" : "pending", credits_spent: price,
    }).select().single();

    const next_retry_at = ["pending", "validating", "transferring"].includes(status) ? nextBackoff(0).toISOString() : null;

    const { data: transfer, error: ie } = await svc.from("kubo_domain_transfers").insert({
      user_id: user.id, domain_id: dom?.id ?? null, domain_name: domain,
      auth_code, current_registrar, status, ionos_transfer_id, status_message: statusMessage,
      notify_email, last_error, next_retry_at,
    }).select().single();
    if (ie) return new Response(JSON.stringify({ error: ie.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await logEvent(svc, transfer.id, user.id, "started", null, status, statusMessage, { ionos_transfer_id, price });
    await notifyStatus(svc, transfer, status, statusMessage);

    return new Response(JSON.stringify({ success: true, transfer, domain: dom, balance_after: (deduct as any)?.balance_after }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// =================== HELPER: poll a single transfer ===================
async function pollTransfer(svc: any, t: any, apiKey: string) {
  if (!apiKey) {
    return { skipped: true, reason: "no_api_key" };
  }

  const fromStatus = t.status;
  let mapped = t.status;
  let httpStatus = 0;
  let bodyText = "";
  let ok = false;

  // Retry attempt without IONOS order id -> can't poll; reschedule
  if (!t.ionos_transfer_id) {
    // Try to re-create order (initial start failed)
    const r = await ionosFetch(apiKey, `/domainorders`, {
      method: "POST",
      body: JSON.stringify([{ domainName: t.domain_name, type: "transfer", authCode: t.auth_code, period: 1 }]),
    });
    httpStatus = r.status;
    bodyText = typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 200);
    if (r.ok) {
      const first = Array.isArray(r.body) ? r.body[0] : r.body;
      const newId = String(first?.id ?? first?.orderId ?? "");
      mapped = "transferring";
      await svc.from("kubo_domain_transfers").update({
        ionos_transfer_id: newId, status: mapped, status_message: "Reenviada à IONOS",
        retry_count: t.retry_count + 1, last_retry_at: new Date().toISOString(),
        next_retry_at: nextBackoff(t.retry_count + 1).toISOString(),
        last_error: null, updated_at: new Date().toISOString(),
      }).eq("id", t.id);
      ok = true;
      await logEvent(svc, t.id, t.user_id, "retry.success", fromStatus, mapped, "Pedido reenviado à IONOS", { http: httpStatus, retry_count: t.retry_count + 1 });
    } else {
      const newRetry = t.retry_count + 1;
      const failed = newRetry >= MAX_RETRIES;
      mapped = failed ? "failed" : "pending";
      await svc.from("kubo_domain_transfers").update({
        status: mapped, status_message: `Retry ${newRetry}/${MAX_RETRIES} — IONOS ${httpStatus}`,
        retry_count: newRetry, last_retry_at: new Date().toISOString(),
        next_retry_at: failed ? null : nextBackoff(newRetry).toISOString(),
        last_error: bodyText, updated_at: new Date().toISOString(),
      }).eq("id", t.id);
      await logEvent(svc, t.id, t.user_id, failed ? "retry.exhausted" : "retry.failed", fromStatus, mapped, `IONOS ${httpStatus}`, { http: httpStatus, body: bodyText, retry_count: newRetry });
    }
  } else {
    const r = await ionosFetch(apiKey, `/domainorders/${encodeURIComponent(t.ionos_transfer_id)}`);
    httpStatus = r.status;
    bodyText = typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 200);
    ok = r.ok;
    const ionosStatus = r.body?.status ?? r.body?.properties?.status ?? null;
    if (ok && ionosStatus) {
      mapped = mapIonosStatus(String(ionosStatus));
      const update: any = {
        status: mapped, status_message: `IONOS: ${ionosStatus}`,
        retry_count: 0, last_retry_at: new Date().toISOString(),
        next_retry_at: ["completed", "failed"].includes(mapped) ? null : nextBackoff(0).toISOString(),
        last_error: null, updated_at: new Date().toISOString(),
      };
      if (mapped === "completed") {
        update.completed_at = new Date().toISOString();
        if (t.domain_id) await svc.from("kubo_domains").update({ status: "active", ssl_status: "provisioning" }).eq("id", t.domain_id);
      }
      await svc.from("kubo_domain_transfers").update(update).eq("id", t.id);
      if (fromStatus !== mapped) {
        await logEvent(svc, t.id, t.user_id, "status_change", fromStatus, mapped, `IONOS: ${ionosStatus}`, { http: httpStatus });
      }
    } else {
      const newRetry = t.retry_count + 1;
      const failed = newRetry >= MAX_RETRIES;
      mapped = failed ? "failed" : t.status;
      await svc.from("kubo_domain_transfers").update({
        status: mapped, status_message: `Retry ${newRetry}/${MAX_RETRIES} — IONOS ${httpStatus}`,
        retry_count: newRetry, last_retry_at: new Date().toISOString(),
        next_retry_at: failed ? null : nextBackoff(newRetry).toISOString(),
        last_error: bodyText, updated_at: new Date().toISOString(),
      }).eq("id", t.id);
      await logEvent(svc, t.id, t.user_id, failed ? "retry.exhausted" : "retry.failed", fromStatus, mapped, `IONOS ${httpStatus}`, { http: httpStatus, body: bodyText, retry_count: newRetry });
    }
  }

  await logConn(svc, t.user_id, "transfer.poll", ok ? "success" : "warning",
    `${t.domain_name}: ${fromStatus} → ${mapped} (HTTP ${httpStatus})`,
    { transfer_id: t.id, http: httpStatus });

  // Email notification on terminal/changed status
  const { data: fresh } = await svc.from("kubo_domain_transfers").select("*").eq("id", t.id).maybeSingle();
  if (fresh && fresh.status !== fromStatus && ["completed", "failed"].includes(fresh.status)) {
    await notifyStatus(svc, fresh, fresh.status, fresh.status_message);
  }

  return { from: fromStatus, to: mapped, http: httpStatus, ok };
}
