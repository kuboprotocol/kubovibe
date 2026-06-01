import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function buildIonosKey(): string {
  const key = (Deno.env.get("IONOS_API_KEY") ?? "").trim();
  const prefix = (Deno.env.get("IONOS_API_PREFIX") ?? "").trim();
  if (!key) return "";
  if (key.includes(".")) return key;
  if (prefix) return `${prefix}.${key}`;
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = (Deno.env.get("IONOS_API_KEY") ?? "").trim();
  const prefix = (Deno.env.get("IONOS_API_PREFIX") ?? "").trim();
  const composed = buildIonosKey();

  const info = {
    has_key: !!key,
    key_length: key.length,
    key_contains_dot: key.includes("."),
    key_preview: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
    has_prefix: !!prefix,
    prefix_length: prefix.length,
    prefix_preview: prefix ? `${prefix.slice(0, 6)}...` : null,
    composed_length: composed.length,
    composed_preview: composed ? `${composed.slice(0, 8)}...${composed.slice(-4)}` : null,
  };

  const candidates: Record<string, string> = {
    composed: composed,
    key_only: key,
    prefix_dot_key: prefix && key ? `${prefix}.${key}` : "",
  };

  const results: Record<string, any> = {};
  for (const [name, value] of Object.entries(candidates)) {
    if (!value) { results[name] = { skipped: true }; continue; }
    try {
      const res = await fetch("https://api.hosting.ionos.com/domains/v1/domainavailabilities?domain=example-test-kubo-12345.com", {
        headers: { "X-API-Key": value, accept: "application/json" },
      });
      const text = await res.text();
      results[name] = { status: res.status, body: text.slice(0, 300) };
    } catch (e: any) {
      results[name] = { error: e?.message ?? "fetch_failed" };
    }
  }

  return new Response(JSON.stringify({ info, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
