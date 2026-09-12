// KUBO Vibe Code — Live Preview via E2B.
// Sobe um sandbox efêmero, clona o repo (GITHUB_TOKEN/GITHUB_REPO), instala
// dependências e roda o servidor de dev, expondo a URL de preview no mesmo
// chat do Vibe Code. Cobrado por minuto do MESMO ledger de créditos (nunca
// cria um sistema de cobrança paralelo). Auto-shutdown por inatividade.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const E2B_API = "https://api.e2b.dev";
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
const CREDITS_PER_MINUTE = 2;
const START_CHARGE_MINUTES = 5; // cobrança inicial (5 min); ajustada no stop

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function e2bRequest(path: string, init: RequestInit, apiKey: string) {
  const r = await fetch(`${E2B_API}${path}`, {
    ...init,
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`e2b_${r.status}:${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_authorization" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes?.user) return json({ error: "invalid_token" }, 401);
  const userId = userRes.user.id;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: { action?: "start" | "stop" | "heartbeat"; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const e2bKey = Deno.env.get("E2B_API_KEY");
  const repo = Deno.env.get("GITHUB_REPO");
  const ghToken = Deno.env.get("GITHUB_TOKEN");
  const branch = Deno.env.get("GITHUB_BRANCH") ?? "main";

  try {
    if (body.action === "stop") {
      if (!body.sessionId) throw new Error("missing_session_id");
      const { data: session, error } = await admin
        .from("vibe_sandbox_sessions")
        .select("*")
        .eq("id", body.sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !session) throw new Error("session_not_found");

      if (e2bKey && session.e2b_sandbox_id) {
        try {
          await e2bRequest(`/sandboxes/${session.e2b_sandbox_id}`, { method: "DELETE" }, e2bKey);
        } catch (e) {
          console.warn("[vibe-e2b-preview] falha ao encerrar sandbox (ignorado):", e);
        }
      }

      const durationMin = Math.max(1, Math.ceil(
        (Date.now() - new Date(session.started_at).getTime()) / 60000,
      ));
      const totalCredits = durationMin * CREDITS_PER_MINUTE;
      const alreadyCharged = session.credits_charged ?? 0;
      const remaining = Math.max(0, totalCredits - alreadyCharged);

      if (remaining > 0) {
        await admin.rpc("execute_atomic_credit_deduction", {
          _user_id: userId,
          _amount: remaining,
          _reason: "vibe_e2b_preview:usage",
          _category: "vibe_sandbox",
          _metadata: { session_id: session.id, duration_minutes: durationMin },
          _idempotency_key: `e2b-stop-${session.id}`,
        });
      }

      await admin
        .from("vibe_sandbox_sessions")
        .update({ status: "stopped", ended_at: new Date().toISOString(), credits_charged: totalCredits })
        .eq("id", session.id);

      return json({ ok: true, status: "stopped", durationMinutes: durationMin, totalCredits });
    }

    if (body.action === "heartbeat") {
      if (!body.sessionId) throw new Error("missing_session_id");
      await admin
        .from("vibe_sandbox_sessions")
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq("id", body.sessionId)
        .eq("user_id", userId);
      return json({ ok: true });
    }

    // action === "start" (padrão)
    if (!e2bKey) throw new Error("missing_secret:E2B_API_KEY");
    if (!repo || !ghToken) throw new Error("missing_secret:GITHUB_TOKEN_ou_GITHUB_REPO");

    // Encerra sessões antigas do mesmo usuário/repo que ficaram sem heartbeat
    // (proteção contra sandbox órfão consumindo crédito indefinidamente).
    await admin
      .from("vibe_sandbox_sessions")
      .update({ status: "timed_out", ended_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "running")
      .lt("last_heartbeat_at", new Date(Date.now() - IDLE_TIMEOUT_MS).toISOString());

    // Cobrança inicial (créditos de uma sessão curta); ajuste fino acontece no stop.
    const { data: charge, error: chargeError } = await admin.rpc("execute_atomic_credit_deduction", {
      _user_id: userId,
      _amount: START_CHARGE_MINUTES * CREDITS_PER_MINUTE,
      _reason: "vibe_e2b_preview:start",
      _category: "vibe_sandbox",
      _metadata: { repo, branch },
      _idempotency_key: `e2b-start-${userId}-${crypto.randomUUID()}`,
    });
    if (chargeError) throw new Error(chargeError.message ?? "credit_deduction_failed");

    const { data: sessionRow, error: insertError } = await admin
      .from("vibe_sandbox_sessions")
      .insert({
        user_id: userId,
        project_repo: repo,
        status: "starting",
        credits_charged: START_CHARGE_MINUTES * CREDITS_PER_MINUTE,
      })
      .select("id")
      .single();
    if (insertError || !sessionRow) throw new Error("session_create_failed");

    // Cria o sandbox E2B, clona o repo e sobe o servidor de dev.
    const sandbox = await e2bRequest(
      "/sandboxes",
      {
        method: "POST",
        body: JSON.stringify({
          templateID: Deno.env.get("E2B_TEMPLATE_ID") ?? "base",
          metadata: { userId, repo, sessionId: sessionRow.id },
        }),
      },
      e2bKey,
    );

    const sandboxId = sandbox.sandboxID ?? sandbox.sandboxId ?? sandbox.id;
    if (!sandboxId) throw new Error("e2b_sandbox_id_missing_in_response");

    const setupCmd = [
      `git clone https://x-access-token:${ghToken}@github.com/${repo}.git app`,
      `cd app && git checkout ${branch}`,
      `npm install`,
      `nohup npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/dev.log 2>&1 &`,
    ].join(" && ");

    await e2bRequest(
      `/sandboxes/${sandboxId}/process`,
      { method: "POST", body: JSON.stringify({ cmd: "bash", args: ["-lc", setupCmd] }) },
      e2bKey,
    );

    const previewUrl = `https://5173-${sandboxId}.e2b.dev`;

    await admin
      .from("vibe_sandbox_sessions")
      .update({ status: "running", e2b_sandbox_id: sandboxId, preview_url: previewUrl })
      .eq("id", sessionRow.id);

    return json({
      ok: true,
      sessionId: sessionRow.id,
      previewUrl,
      creditsChargedNow: START_CHARGE_MINUTES * CREDITS_PER_MINUTE,
      balanceAfter: (charge as { balance_after?: number })?.balance_after,
      note: "Preview pode levar de 20 a 60s para ficar acessível enquanto as dependências instalam.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    console.error("[vibe-e2b-preview]", message);
    return json({ error: message }, 500);
  }
});
