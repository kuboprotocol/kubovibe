// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const IONOS_API = "https://api.hosting.ionos.com/domains/v1";
const TLD_PRICES_CREDITS: Record<string, number> = {
  com: 15, "com.br": 25, net: 16, org: 16, dev: 18, app: 22,
  io: 50, ai: 80, co: 30, xyz: 8, tech: 20, store: 25, online: 18,
};

function tldOf(domain: string) {
  const parts = domain.toLowerCase().split(".");
  if (parts.length >= 3 && parts[parts.length - 2] === "com" && parts[parts.length - 1] === "br") return "com.br";
  return parts[parts.length - 1] ?? "com";
}

async function checkIonosAvailability(domain: string, apiKey: string) {
  try {
    const url = `${IONOS_API}/domainavailabilities?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { headers: { "X-API-Key": apiKey, accept: "application/json" } });
    if (!res.ok) return { available: null, reason: `IONOS ${res.status}` };
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : data;
    return { available: first?.available === true, raw: first };
  } catch (e: any) {
    return { available: null, reason: e?.message ?? "fetch_failed" };
  }
}

async function aiSuggest(seed: string, limit = 6): Promise<string[]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return [];
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Generate brandable domain names. Output ONLY a JSON array of plain domain strings (no protocol, no www), max 8 items, mix .com .io .dev .ai .app .co .xyz." },
          { role: "user", content: `Seed: "${seed}". Suggest ${limit} memorable, short domains.` },
        ],
      }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const text: string = j?.choices?.[0]?.message?.content ?? "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.slice(0, limit).map((s) => String(s).toLowerCase()) : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const query: string = String(body?.query ?? "").trim().toLowerCase().replace(/[^a-z0-9.-]/g, "");
    if (!query || query.length < 2) return new Response(JSON.stringify({ error: "query too short" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("IONOS_API_KEY") ?? "";
    const hasIonos = !!apiKey;

    // Build candidate list: direct query + tld variations + AI suggestions
    const base = query.includes(".") ? query.split(".")[0] : query;
    const directs = query.includes(".") ? [query] : [];
    const variants = ["com", "io", "dev", "app", "ai", "co", "xyz", "com.br"].map((t) => `${base}.${t}`);
    const ai = await aiSuggest(base, 6);
    const candidates = Array.from(new Set([...directs, ...variants, ...ai])).slice(0, 16);

    const results = await Promise.all(candidates.map(async (d) => {
      const tld = tldOf(d);
      const price = TLD_PRICES_CREDITS[tld] ?? 20;
      if (!hasIonos) return { domain: d, tld, available: null, price_credits: price, note: "IONOS_API_KEY not set" };
      const av = await checkIonosAvailability(d, apiKey);
      return { domain: d, tld, available: av.available, price_credits: price, reason: av.reason };
    }));

    return new Response(JSON.stringify({ query, results, has_ionos: hasIonos }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
