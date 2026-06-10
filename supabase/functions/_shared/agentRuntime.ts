// Runtime compartilhado para todos os microsserviços de agentes do KUBO Creative Studio.
// Responsabilidades: CORS, validação JWT, débito atômico de créditos, registro de job,
// trilha de auditoria e padronização de respostas.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id, x-correlation-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface AgentContext {
  userId: string;
  jobId: string;
  requestId: string;
  agentSlug: string;
  creditCost: number;
  input: Record<string, unknown>;
  admin: SupabaseClient;
  user: SupabaseClient;
}

export interface AgentHandlerResult {
  output: Record<string, unknown>;
  // se setado, sobrescreve os créditos cobrados (ex.: cobrança variável)
  creditsCharged?: number;
}

export type AgentHandler = (ctx: AgentContext) => Promise<AgentHandlerResult>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Executa um agente com gancho completo de créditos + jobs + auditoria.
 * @param agentSlug slug em public.agent_registry
 * @param req request original
 * @param handler implementação do agente
 */
export async function runAgent(
  agentSlug: string,
  req: Request,
  handler: AgentHandler,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const requestId =
    req.headers.get("x-request-id") ?? crypto.randomUUID();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Auth — sempre valida JWT via getUser (não confia no payload do cliente)
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "missing_authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return jsonResponse({ error: "invalid_token" }, 401);
  }
  const userId = userRes.user.id;

  // 2) Catálogo
  const { data: agent, error: agentErr } = await admin
    .from("agent_registry")
    .select("slug, credit_cost, status, name")
    .eq("slug", agentSlug)
    .maybeSingle();
  if (agentErr || !agent) return jsonResponse({ error: "agent_not_found" }, 404);
  if (agent.status === "disabled") {
    return jsonResponse({ error: "agent_disabled" }, 403);
  }

  // 3) Parse input
  let input: Record<string, unknown> = {};
  try {
    const body = await req.text();
    if (body) input = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "invalid_json_body" }, 400);
  }

  // 4) Cria job em status queued
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;
  const { data: job, error: jobErr } = await admin
    .from("agent_jobs")
    .insert({
      user_id: userId,
      agent_slug: agentSlug,
      status: "queued",
      input,
      request_id: requestId,
      correlation_id: correlationId,
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    console.error("[runAgent] job_create_failed:", jobErr);
    return jsonResponse({ error: "job_create_failed" }, 500);
  }

  const jobId = job.id as string;
  const startedAt = Date.now();

  // 5) Débito atômico de créditos (RPC já existente)
  const { data: debit, error: debitErr } = await admin.rpc(
    "execute_atomic_credit_deduction",
    {
      _user_id: userId,
      _amount: agent.credit_cost,
      _reason: `agent:${agentSlug}`,
      _category: "agent_execution",
      _metadata: { agent_slug: agentSlug, job_id: jobId, request_id: requestId },
      _idempotency_key: `agent-${jobId}`,
    },
  );

  if (debitErr) {
    const reason = debitErr.message ?? "credit_deduction_failed";
    await admin.from("agent_jobs").update({
      status: "failed",
      error_message: reason,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    await admin.rpc("log_security_audit", {
      _action: `agent.${agentSlug}.denied`,
      _resource_type: "agent",
      _resource_id: agentSlug,
      _job_id: jobId,
      _request_id: requestId,
      _success: false,
      _error_message: reason,
      _metadata: { credit_cost: agent.credit_cost },
      _actor_user_id: userId,
    });
    const status = reason.includes("insufficient_credits") ? 402 : 500;
    return jsonResponse({ error: reason, job_id: jobId }, status);
  }

  // 6) Executa handler com try/catch + reembolso em caso de falha
  try {
    await admin.from("agent_jobs").update({ status: "running" }).eq("id", jobId);

    const result = await handler({
      userId,
      jobId,
      requestId,
      agentSlug,
      creditCost: agent.credit_cost,
      input,
      admin,
      user: userClient,
    });

    const duration = Date.now() - startedAt;
    const charged = result.creditsCharged ?? agent.credit_cost;

    await admin.from("agent_jobs").update({
      status: "succeeded",
      output: result.output,
      credits_charged: charged,
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    // Record in unified skill_executions table
    await admin.from("skill_executions").insert({
      user_id: userId,
      skill_slug: agentSlug,
      skill_name: agent.name,
      input,
      output: result.output,
      status: "succeeded",
      credits_charged: charged,
      duration_ms: duration,
    });

    await admin.rpc("log_security_audit", {
      _action: `agent.${agentSlug}.succeeded`,
      _resource_type: "agent",
      _resource_id: agentSlug,
      _job_id: jobId,
      _request_id: requestId,
      _success: true,
      _metadata: { credits_charged: charged, duration_ms: duration },
      _actor_user_id: userId,
    });

    return jsonResponse({
      ok: true,
      job_id: jobId,
      agent: agentSlug,
      credits_charged: charged,
      balance_after: (debit as { balance_after?: number })?.balance_after,
      duration_ms: duration,
      output: result.output,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    // Sanitize error message to avoid leaking internal details
    const safeMessage = (message.includes("database") || message.includes("sql") || message.includes("/")) 
      ? "internal_server_error" 
      : message;

    // reembolso simétrico (insere crédito positivo no ledger)
    try {
      await admin.from("credit_transactions").insert({
        user_id: userId,
        delta: agent.credit_cost,
        balance_after: null,
        reason: `refund:${agentSlug}`,
        category: "agent_refund",
        metadata: { job_id: jobId, agent_slug: agentSlug, error: message },
      });
      await admin
        .from("subscriptions")
        .update({ edits_used: (await admin
          .from("subscriptions")
          .select("edits_used")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle()).data?.edits_used ?? 0 })
        .eq("user_id", userId)
        .eq("is_active", true);
    } catch {
      // best-effort refund — não falha o response final
    }

    await admin.from("agent_jobs").update({
      status: "refunded",
      error_message: message,
      duration_ms: Date.now() - startedAt,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    // Record failure in unified skill_executions table
    await admin.from("skill_executions").insert({
      user_id: userId,
      skill_slug: agentSlug,
      skill_name: agent.name,
      input,
      status: "failed",
      error_message: message,
      credits_charged: 0,
      duration_ms: Date.now() - startedAt,
    });

    await admin.rpc("log_security_audit", {
      _action: `agent.${agentSlug}.failed`,
      _resource_type: "agent",
      _resource_id: agentSlug,
      _job_id: jobId,
      _request_id: requestId,
      _success: false,
      _error_message: message,
      _metadata: { refunded: true },
      _actor_user_id: userId,
    });

    return jsonResponse({ error: safeMessage, job_id: jobId, refunded: true }, 500);
  }
}

/** Helpers para handlers consumirem APIs externas com chave gerenciada. */
export function getSecret(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing_secret:${name}`);
  return v;
}
