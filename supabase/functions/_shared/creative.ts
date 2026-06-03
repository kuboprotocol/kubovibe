// Shared helpers for the Creative Economy panel edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const ADMIN_EMAIL = "kuboprotocol@gmail.com";

export async function deductCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {},
  userEmail?: string | null,
): Promise<{ ok: true; replayed?: boolean } | { ok: false; error: string }> {
  if (amount <= 0) return { ok: true };
  // Admin bypass
  if (userEmail && userEmail.toLowerCase() === ADMIN_EMAIL) return { ok: true };

  const admin = supaAdmin();
  const idempotencyKey = `${reason}-${userId}-${Date.now()}-${crypto.randomUUID()}`;
  const { data, error } = await admin.rpc("execute_atomic_credit_deduction", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _category: "creative_economy",
    _metadata: metadata,
    _idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, error: error.message };
  if (!(data as any)?.success) return { ok: false, error: "deduction_failed" };
  return { ok: true };
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
