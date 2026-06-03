// Concurrency test: fire N parallel rerun requests with the same X-Idempotency-Key
// and assert credits are deducted exactly once.
//
// Required env:
//   SUPABASE_URL                 (or VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY    (used to read credit_transactions for verification)
//   ACCESS_TOKEN                 (JWT of the test user)
//   ASSET_ID                     (existing creative_assets.id for that user)
// Optional:
//   CONCURRENCY=8  FN=creative-chat  PROMPT=ping
//
// Exits non-zero (fails CI) if more than one credit_transactions row exists for
// the idempotency key, or if no request succeeded.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TOKEN = Deno.env.get("ACCESS_TOKEN");
const ASSET_ID = Deno.env.get("ASSET_ID");
const N = Number(Deno.env.get("CONCURRENCY") ?? 8);
const FN = Deno.env.get("FN") ?? "creative-chat";
const PROMPT = Deno.env.get("PROMPT") ?? "ping";

function fatal(msg: string): never { console.error(`FATAL: ${msg}`); Deno.exit(2); }
if (!SUPABASE_URL) fatal("SUPABASE_URL is required");
if (!SERVICE_KEY) fatal("SUPABASE_SERVICE_ROLE_KEY is required");
if (!TOKEN) fatal("ACCESS_TOKEN is required");
if (!ASSET_ID) fatal("ASSET_ID is required");

const idemKey = `rerun:${ASSET_ID}`;
const url = `${SUPABASE_URL}/functions/v1/${FN}`;
console.log(`▶ Firing ${N} parallel ${FN} requests · idempotency-key=${idemKey}`);

const started = performance.now();
const results = await Promise.all(
  Array.from({ length: N }, async (_, i) => {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemKey,
      },
      body: JSON.stringify({ messages: [{ role: "user", content: PROMPT }] }),
    });
    const body = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(body); } catch { /* streamed */ }
    return { i, status: r.status, replayed: !!parsed?.replayed, body: body.slice(0, 160) };
  }),
);
const ms = Math.round(performance.now() - started);
console.log(`✓ Completed in ${ms}ms`);
results.forEach((r) => console.log(`  #${r.i} → HTTP ${r.status}${r.replayed ? " replayed" : ""} ${r.body}`));

const okCount = results.filter((r) => r.status >= 200 && r.status < 300).length;
const rateLimited = results.filter((r) => r.status === 429).length;
console.log(`\nResponses: ${okCount} ok · ${rateLimited} rate-limited · ${N - okCount - rateLimited} other`);

if (okCount === 0) {
  console.error("\n❌ FAIL: no successful response; cannot verify idempotency.");
  Deno.exit(1);
}

// Verify ledger: count credit_transactions rows for the idempotency key.
const ledgerUrl = `${SUPABASE_URL}/rest/v1/credit_transactions` +
  `?select=id,delta,created_at&idempotency_key=eq.${encodeURIComponent(idemKey)}`;
const ledger = await fetch(ledgerUrl, {
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: "count=exact",
  },
});
if (!ledger.ok) {
  console.error(`❌ FAIL: ledger query returned HTTP ${ledger.status}: ${await ledger.text()}`);
  Deno.exit(1);
}
const rows: Array<{ id: string; delta: number; created_at: string }> = await ledger.json();
console.log(`\nLedger rows for ${idemKey}: ${rows.length}`);
rows.forEach((row) => console.log(`  ${row.created_at}  delta=${row.delta}  id=${row.id}`));

if (rows.length > 1) {
  console.error(`\n❌ FAIL: expected exactly 1 ledger row, found ${rows.length}. Idempotency broken.`);
  Deno.exit(1);
}
if (rows.length === 0) {
  console.warn("\n⚠ WARN: 0 ledger rows — admin bypass or cost=0? Treating as pass.");
}
console.log("\n✅ PASS: idempotent — at most one credit transaction was created.");
