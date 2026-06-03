// Preflight checks for the rerun-concurrency CI test.
// Validates that all secrets/vars are set, the access token can call the API,
// and the asset exists and belongs to the token's user — BEFORE we spend
// credits / hit rate limits in the concurrency test itself.
//
// Local usage:
//   set -a && source .env.rerun-ci && set +a
//   deno run --allow-net --allow-env scripts/preflight-rerun.ts
//
// Exits 0 on success, 1 on any failure (prints actionable error).

type Check = { name: string; ok: boolean; detail?: string };

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ACCESS_TOKEN",
  "ASSET_ID",
];

const results: Check[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1) Env presence
const env: Record<string, string> = {};
let missing = false;
for (const key of required) {
  const v = Deno.env.get(key) ?? "";
  if (!v) {
    record(`env:${key}`, false, "missing or empty");
    missing = true;
  } else {
    env[key] = v;
    record(`env:${key}`, true, `${v.slice(0, 8)}…(${v.length} chars)`);
  }
}
if (missing) {
  console.error("\nFix: populate the missing secrets/vars and re-run.");
  Deno.exit(1);
}

// 2) URL shape
try {
  const u = new URL(env.SUPABASE_URL);
  if (!u.protocol.startsWith("https")) throw new Error("must be https://");
  record("url:supabase", true, u.host);
} catch (e) {
  record("url:supabase", false, (e as Error).message);
  Deno.exit(1);
}

// 3) UUID shape for ASSET_ID
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRe.test(env.ASSET_ID)) {
  record("uuid:ASSET_ID", false, "not a valid UUID");
  Deno.exit(1);
}
record("uuid:ASSET_ID", true);

const restBase = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

// 4) ACCESS_TOKEN can call the API (auth.getUser via PostgREST: hit a benign endpoint)
let tokenUserId: string | null = null;
try {
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.ACCESS_TOKEN}`,
    },
  });
  if (!r.ok) {
    const body = await r.text();
    record("auth:access_token", false, `HTTP ${r.status} — ${body.slice(0, 160)}`);
    if (r.status === 401) {
      console.error("\nFix: ACCESS_TOKEN expired or invalid. Re-login the test user and copy a fresh access_token from sb-<ref>-auth-token in localStorage.");
    }
    Deno.exit(1);
  }
  const u = await r.json();
  tokenUserId = u?.id ?? null;
  record("auth:access_token", true, `user=${tokenUserId}`);
} catch (e) {
  record("auth:access_token", false, (e as Error).message);
  Deno.exit(1);
}

// 5) Asset exists AND belongs to that user (use service role to bypass RLS for the check)
try {
  const r = await fetch(
    `${restBase}/creative_assets?id=eq.${env.ASSET_ID}&select=id,user_id,kind`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: "application/json",
      },
    },
  );
  if (!r.ok) {
    const body = await r.text();
    record("asset:exists", false, `HTTP ${r.status} — ${body.slice(0, 160)}`);
    Deno.exit(1);
  }
  const rows = (await r.json()) as Array<{ id: string; user_id: string; kind?: string }>;
  if (rows.length === 0) {
    record("asset:exists", false, `no row in creative_assets with id=${env.ASSET_ID}`);
    console.error("\nFix: pick a real asset id — `select id from public.creative_assets order by created_at desc limit 1;`");
    Deno.exit(1);
  }
  record("asset:exists", true, `kind=${rows[0].kind ?? "?"}`);

  if (tokenUserId && rows[0].user_id !== tokenUserId) {
    record("asset:owner_matches_token", false, `asset.user_id=${rows[0].user_id} ≠ token.user=${tokenUserId}`);
    console.error("\nFix: ASSET_ID must belong to the user behind ACCESS_TOKEN, otherwise RLS will block creative-* edge functions.");
    Deno.exit(1);
  }
  record("asset:owner_matches_token", true);
} catch (e) {
  record("asset:exists", false, (e as Error).message);
  Deno.exit(1);
}

// 6) Subscription exists & has credits (so the concurrency test doesn't fail for "insufficient_credits")
try {
  const r = await fetch(
    `${restBase}/subscriptions?user_id=eq.${tokenUserId}&is_active=eq.true&select=edits_limit,edits_used,plan`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  const rows = (await r.json()) as Array<{ edits_limit: number; edits_used: number; plan: string }>;
  if (!r.ok || rows.length === 0) {
    record("subscription:active", false, "no active subscription for token user");
    Deno.exit(1);
  }
  const remaining = rows[0].edits_limit - rows[0].edits_used;
  if (remaining < 5) {
    record("subscription:credits", false, `only ${remaining} credits remaining (need ≥5)`);
    console.error("\nFix: grant credits to the test user before running the concurrency test.");
    Deno.exit(1);
  }
  record("subscription:credits", true, `${remaining} remaining (plan=${rows[0].plan})`);
} catch (e) {
  record("subscription:active", false, (e as Error).message);
  Deno.exit(1);
}

// 7) Reach the target edge function with a HEAD/OPTIONS (CORS preflight) — confirms it's deployed
const fn = Deno.env.get("FN") ?? "creative-chat";
try {
  const r = await fetch(`${env.SUPABASE_URL}/functions/v1/${fn}`, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      Origin: "https://preflight.local",
    },
  });
  // Edge functions answer OPTIONS with 200/204 even without auth.
  if (r.status >= 500) {
    record(`edge:${fn}`, false, `HTTP ${r.status} on OPTIONS`);
    Deno.exit(1);
  }
  record(`edge:${fn}`, true, `OPTIONS ${r.status}`);
} catch (e) {
  record(`edge:${fn}`, false, (e as Error).message);
  Deno.exit(1);
}

console.log("\n✅ Preflight passed — safe to run the concurrency test.");
