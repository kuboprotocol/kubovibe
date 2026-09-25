// Shared auth for the wgsl-sanitizer integration/fuzz tests.
//
// The edge function requires a signed-in user (supabase.auth.getUser()), so
// the tests sign in a dedicated test account with the password grant and
// send its access token. The publishable (anon) key alone is not a user
// session and is rejected with 401 — that guard has its own tests.
//
// Without TEST_EMAIL / TEST_PASSWORD the user-scoped tests are ignored
// (reported as "ignored" by `deno test`, never silently passed), mirroring
// the e2e/ specs.

import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load the committed .env (public Supabase URL + publishable key). Not
// dotenv/load.ts: that one also enforces every key in .env.example, and the
// example lists secrets (e.g. VITE_RLS_TEST_SECRET) these tests never use.
// Variables already set in the environment keep precedence.
loadSync({ export: true, examplePath: null });

export const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "";
export const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
export const ENDPOINT = `${SUPABASE_URL}/functions/v1/wgsl-sanitizer`;

const TEST_EMAIL = Deno.env.get("TEST_EMAIL") ?? "";
const TEST_PASSWORD = Deno.env.get("TEST_PASSWORD") ?? "";
export const HAS_TEST_USER = TEST_EMAIL !== "" && TEST_PASSWORD !== "";

let tokenPromise: Promise<string> | null = null;

/** Access token for the test user, fetched once per test run. */
export function userToken(): Promise<string> {
  tokenPromise ??= (async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    const json = await res.json();
    if (!res.ok || typeof json.access_token !== "string") {
      throw new Error(`Test user sign-in failed (HTTP ${res.status}): ${json.error_description ?? json.msg ?? "no access_token"}`);
    }
    return json.access_token as string;
  })();
  return tokenPromise;
}

/** POSTs to the sanitizer as the signed-in test user. */
export async function callSanitizer(body: unknown) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await userToken()}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json } as { status: number; json: any };
}

/** Deno.test that needs the signed-in test user; ignored without credentials. */
export function userTest(name: string, fn: () => Promise<void>) {
  Deno.test({ name, ignore: !HAS_TEST_USER, fn });
}
