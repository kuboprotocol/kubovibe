// supabase/functions/runway-generate/index.ts
// Generic RunwayML dispatcher for the Kubo Vibe Dev app.
//
// Auth     : Bearer JWT (validated via auth.getUser()).
// Credits  : debits 28 credits per *generation start* via execute_atomic_credit_deduction.
//            Polling task status is free (and idempotent on the user side).
// Endpoints: text_to_image | image_to_video | video_upscale | character_performance
//
// Routes:
//   POST /runway-generate        body: { endpoint, payload }      → { taskId }
//   GET  /runway-generate?id=…   (no body)                        → { id, status, output?, failure? }
//
// Runway dev API base: https://api.dev.runwayml.com/v1
// Required version header: X-Runway-Version: 2024-11-06

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const CREDIT_COST = 28;

const ENDPOINT_MAP = {
  text_to_image:         { path: "text_to_image",         category: "runway_image" },
  image_to_video:        { path: "image_to_video",        category: "runway_video" },
  video_upscale:         { path: "video_upscale",         category: "runway_upscale" },
  character_performance: { path: "character_performance", category: "runway_character" },
} as const;
type EndpointKey = keyof typeof ENDPOINT_MAP;

const StartSchema = z.object({
  endpoint: z.enum(["text_to_image", "image_to_video", "video_upscale", "character_performance"]),
  // Runway payload is forwarded verbatim. We don't enumerate sub-schemas here
  // because each endpoint has its own model-specific fields (promptText,
  // promptImage, ratio, duration, etc.) — see Runway docs.
  payload: z.record(z.unknown()),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const RUNWAY_KEY = Deno.env.get("RUNWAYML_API_SECRET");
  if (!RUNWAY_KEY) return json({ error: "runway_not_configured" }, 500);

  // ── Auth: validate JWT and resolve user via auth.getUser() ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  // Admin client used for the credit RPC (security definer needs service role context).
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const runwayHeaders = {
    Authorization: `Bearer ${RUNWAY_KEY}`,
    "X-Runway-Version": RUNWAY_VERSION,
    "Content-Type": "application/json",
  };

  try {
    // ── GET: poll task status (free) ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const taskId = url.searchParams.get("id");
      if (!taskId) return json({ error: "missing_task_id" }, 400);

      const r = await fetch(`${RUNWAY_BASE}/tasks/${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers: runwayHeaders,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: "runway_task_error", status: r.status, detail: body }, r.status);
      return json(body);
    }

    // ── POST: start a generation ──
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const parsed = StartSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid_body", detail: parsed.error.flatten() }, 400);

    const { endpoint, payload } = parsed.data;
    const meta = ENDPOINT_MAP[endpoint as EndpointKey];

    // Idempotency: same {user, endpoint, payload-hash} debits credits only once.
    const payloadHash = await hash(JSON.stringify({ endpoint, payload }));
    const idempotencyKey = `runway:${userId}:${payloadHash}`;

    const { data: debit, error: debitErr } = await admin.rpc(
      "execute_atomic_credit_deduction",
      {
        _user_id: userId,
        _amount: CREDIT_COST,
        _reason: `runway:${endpoint}`,
        _category: meta.category,
        _metadata: { endpoint, payload_hash: payloadHash },
        _idempotency_key: idempotencyKey,
      },
    );
    if (debitErr) {
      const message = debitErr.message || "";
      if (message.includes("insufficient_credits")) return json({ error: "insufficient_credits" }, 402);
      if (message.includes("subscription_not_found")) return json({ error: "no_subscription" }, 402);
      return json({ error: "credit_debit_failed", detail: message }, 500);
    }

    // Forward to Runway
    const r = await fetch(`${RUNWAY_BASE}/${meta.path}`, {
      method: "POST",
      headers: runwayHeaders,
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      // NOTE: we intentionally do NOT refund here — Runway may have charged
      // their side too, and idempotency would replay the same debit on retry.
      // Manual ops can refund via admin if needed.
      return json(
        { error: "runway_start_failed", status: r.status, detail: body, balance_after: debit?.balance_after },
        r.status,
      );
    }

    return json({
      taskId: (body as { id?: string }).id,
      status: (body as { status?: string }).status ?? "PENDING",
      endpoint,
      credits_debited: debit?.replayed ? 0 : CREDIT_COST,
      replayed: !!debit?.replayed,
      balance_after: debit?.balance_after ?? null,
    });
  } catch (err) {
    return json({ error: "internal_error", detail: (err as Error).message }, 500);
  }
});

async function hash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
