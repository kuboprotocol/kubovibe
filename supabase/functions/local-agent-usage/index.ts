// Ponte entre o KUBO Local Agent (daemon) e o ledger de créditos (Vibe Bank).
//   POST → debita uma ação de IA (idempotente por idempotency_key)
//   GET  → saldo atual + últimos gastos do agent local
//
// Aceita dois tipos de credencial no Authorization: Bearer:
//   - `kubo_la_...`: token de longa duração criado em /download (tabela
//     local_agent_keys). É o caminho recomendado — não expira.
//   - JWT de sessão do Supabase: compatibilidade com agents pareados antes
//     dos tokens existirem (expira em ~1h).
// Por isso verify_jwt = false no config.toml: a autenticação é feita aqui.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const COSTS: Record<string, number> = {
  local_agent_chat: 1,
  local_agent_edit: 2,
  local_agent_run: 4,
  local_agent_terminal: 0,
  local_agent_git: 0,
};

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveUserId(
  authHeader: string,
  admin: SupabaseClient,
  url: string,
  anon: string,
): Promise<string | null> {
  const token = authHeader.slice("Bearer ".length).trim();
  if (token.startsWith("kubo_la_")) {
    const { data } = await admin
      .from("local_agent_keys")
      .select("id,user_id")
      .eq("key_hash", await sha256Hex(token))
      .is("revoked_at", null)
      .maybeSingle();
    if (!data) return null;
    await admin.from("local_agent_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    return data.user_id as string;
  }
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await userClient.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const userId = await resolveUserId(authHeader, admin, url, anon);
    if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

    if (req.method === "GET") {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("edits_limit,edits_used")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const { data: recent } = await admin
        .from("credit_transactions")
        .select("delta,balance_after,reason,created_at")
        .eq("user_id", userId)
        .eq("category", "local_agent")
        .order("created_at", { ascending: false })
        .limit(10);
      return json({
        ok: true,
        balance: sub ? sub.edits_limit - sub.edits_used : null,
        limit: sub?.edits_limit ?? null,
        recent: recent ?? [],
      });
    }

    if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (!(action in COSTS)) return json({ ok: false, error: "invalid action" }, 400);

    const amount = COSTS[action];
    if (amount === 0) return json({ ok: true, charged: 0, balance_after: null });

    const { data, error } = await admin.rpc("execute_atomic_credit_deduction", {
      _user_id: userId,
      _amount: amount,
      _reason: action,
      _category: "local_agent",
      _metadata: {
        source: "kubo-agent",
        project_id: body.project_id ?? null,
      },
      _idempotency_key: body.idempotency_key ?? null,
    });

    if (error) {
      // A RPC sinaliza falta de saldo / de assinatura com RAISE EXCEPTION.
      const paymentIssue = /insufficient_credits|subscription_not_found/.test(error.message);
      return json(
        { ok: false, error: paymentIssue ? "insufficient_credits" : error.message },
        paymentIssue ? 402 : 400,
      );
    }

    const result = data as { balance_after?: number } | null;
    return json({ ok: true, charged: amount, balance_after: result?.balance_after ?? null });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
