import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Check env vars", () => {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  console.log("SUPABASE_URL exists:", !!url);
  console.log("SUPABASE_ANON_KEY exists:", !!anon);
  console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!service);
  
  assert(url, "SUPABASE_URL is required");
});
