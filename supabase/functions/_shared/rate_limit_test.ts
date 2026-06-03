// Validates Creative Economy per-tool rate limit (20 req / 60s).
// Runs against the live Supabase instance using SUPABASE_SERVICE_ROLE_KEY.
// Invokes bump_rate_limit RPC directly to simulate 25 hits in the same window.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX = 20;

Deno.test("rate limit caps at 20 hits per 60s window", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const fakeUser = crypto.randomUUID();
  const bucket = `creative:test_${Date.now()}`;

  const counts: number[] = [];
  for (let i = 0; i < 25; i++) {
    const { data, error } = await admin.rpc("bump_rate_limit", {
      _bucket: bucket,
      _user: fakeUser,
      _window_seconds: 60,
    });
    assert(!error, `RPC failed at iter ${i}: ${error?.message}`);
    counts.push(Number(data));
  }

  console.log("counts:", counts);
  // First 20 hits are within the allowance, hit 21 must exceed MAX
  assertEquals(counts[19], 20, "20th hit should equal MAX");
  assert(counts[20] > MAX, `21st hit must exceed MAX (got ${counts[20]})`);
  assertEquals(counts[24], 25, "counter must keep climbing past the limit");
});
