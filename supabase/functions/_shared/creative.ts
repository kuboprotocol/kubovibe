// Shared helpers for the Creative Economy panel edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function sanitizeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Bloqueia mensagens que contenham termos sensíveis de infra ou banco
  if (
    message.includes("database") ||
    message.includes("sql") ||
    message.includes("pg_") ||
    message.includes("relation") ||
    message.includes("/") ||
    message.includes("\\")
  ) {
    return "internal_server_error";
  }
  return message;
}

export function supaForUser(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export function supaAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getUser(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const c = supaForUser(authHeader);
  const { data } = await c.auth.getUser(authHeader.replace("Bearer ", ""));
  return data?.user ?? null;
}



// Rate limit per tool per user. Default: 20 requests per 60 seconds.
export async function enforceRateLimit(
  userId: string,
  tool: string,
  opts: { max?: number; windowSeconds?: number; userEmail?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string; retryAfter: number }> {
  const admin = supaAdmin();
  const { data: isAdmin } = await admin.rpc("is_admin", { p_user_id: userId });
  if (isAdmin) return { ok: true };
  const max = opts.max ?? 20;
  const windowSeconds = opts.windowSeconds ?? 60;
  try {
    const admin = supaAdmin();
    const { data, error } = await admin.rpc("bump_rate_limit", {
      _bucket: `creative:${tool}`,
      _user: userId,
      _window_seconds: windowSeconds,
    });
    if (error) return { ok: true }; // fail-open on infra issue
    const count = Number(data ?? 0);
    if (count > max) {
      return { ok: false, error: `rate_limit_exceeded:${tool}:${max}/${windowSeconds}s`, retryAfter: windowSeconds };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function deductCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {},
  userEmail?: string | null,
  idempotencyKey?: string | null,
): Promise<{ ok: true; replayed?: boolean } | { ok: false; error: string; status?: number }> {
  if (amount <= 0) return { ok: true };
  // Admin bypass (rate limit + credits)
  const adminClient = supaAdmin();
  const { data: adminData } = await adminClient.rpc("is_admin", { p_user_id: userId });
  if (adminData) return { ok: true };

  // Per-tool rate limit (20 req/min)
  const rl = await enforceRateLimit(userId, reason, { max: 20, windowSeconds: 60, userEmail });
  if (!rl.ok) return { ok: false, error: rl.error, status: 429 };

  const idem = idempotencyKey && idempotencyKey.length > 0
    ? idempotencyKey
    : `${reason}-${userId}-${Date.now()}-${crypto.randomUUID()}`;
    
  const { data, error } = await adminClient.rpc("execute_atomic_credit_deduction", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _category: "creative_economy",
    _metadata: metadata,
    _idempotency_key: idem,
  });
  
  if (error) {
    console.error("[deductCredits] RPC error:", error);
    return { ok: false, error: error.message };
  }
  
  if (!(data as any)?.success) {
    console.warn("[deductCredits] deduction failed (insufficient funds?)", data);
    return { ok: false, error: "deduction_failed" };
  }
  
  return { ok: true, replayed: !!(data as any)?.replayed };
}

export async function recordSkillExecution(
  userId: string,
  payload: {
    skill_slug: string;
    skill_name?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    status?: string;
    error_message?: string;
    credits_charged?: number;
    duration_ms?: number;
  },
) {
  const admin = supaAdmin();
  const { data, error } = await admin
    .from("skill_executions")
    .insert({
      user_id: userId,
      skill_slug: payload.skill_slug,
      skill_name: payload.skill_name ?? payload.skill_slug,
      input: payload.input ?? {},
      output: payload.output ?? {},
      status: payload.status ?? "succeeded",
      error_message: payload.error_message,
      credits_charged: payload.credits_charged ?? 0,
      duration_ms: payload.duration_ms,
    })
    .select("id")
    .single();
  if (error) console.error("recordSkillExecution error", error);
  return data?.id as string | undefined;
}

export async function updateSkillExecution(
  id: string,
  payload: {
    status?: string;
    output?: Record<string, unknown>;
    error_message?: string;
    duration_ms?: number;
  },
) {
  const admin = supaAdmin();
  const { error } = await admin
    .from("skill_executions")
    .update({
      status: payload.status,
      output: payload.output,
      error_message: payload.error_message,
      duration_ms: payload.duration_ms,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.error("updateSkillExecution error", error);
}

export async function recordAsset(
  userId: string,
  payload: {
    tool: string;
    status?: string;
    prompt?: string;
    output_url?: string;
    output_text?: string;
    metadata?: Record<string, unknown>;
    credits_spent?: number;
  },
) {
  const admin = supaAdmin();
  
  // Record in skill_executions too for unified history
  await recordSkillExecution(userId, {
    skill_slug: payload.tool,
    input: { prompt: payload.prompt, ...payload.metadata },
    output: { url: payload.output_url, text: payload.output_text },
    status: payload.status,
    credits_charged: payload.credits_spent,
  });

  const { data, error } = await admin
    .from("creative_assets")
    .insert({
      user_id: userId,
      tool: payload.tool,
      status: payload.status ?? "completed",
      prompt: payload.prompt ?? null,
      output_url: payload.output_url ?? null,
      output_text: payload.output_text ?? null,
      metadata: payload.metadata ?? {},
      credits_spent: payload.credits_spent ?? 0,
    })
    .select("id")
    .single();
  if (error) console.error("recordAsset error", error);
  return data?.id as string | undefined;
}
