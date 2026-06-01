// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DNS_API = "https://api.hosting.ionos.com/dns/v1";
const VALID_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "NS"];

async function ionosCreate(apiKey: string, zoneName: string, rec: any) {
  // Best-effort: find zone, push record. Returns ionos record id or null.
  try {
    const zr = await fetch(`${DNS_API}/zones?suffix=${encodeURIComponent(zoneName)}`, { headers: { "X-API-Key": apiKey } });
    if (!zr.ok) return null;
    const zones = await zr.json();
    const zone = Array.isArray(zones) ? zones.find((z: any) => z?.name === zoneName) ?? zones[0] : zones;
    if (!zone?.id) return null;
    const cr = await fetch(`${DNS_API}/zones/${zone.id}/records`, {
      method: "PATCH",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify([{ name: rec.name, type: rec.type, content: rec.value, ttl: rec.ttl, prio: rec.priority ?? 0, disabled: false }]),
    });
    if (!cr.ok) return null;
    const data = await cr.json();
    return String(data?.[0]?.id ?? "");
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userRes, error: ue } = await userClient.auth.getUser();
    if (ue || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = userRes.user.id;
    const apiKey = Deno.env.get("IONOS_API_KEY") ?? "";

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "list");
    const domain_id = String(body?.domain_id ?? "");
    if (!domain_id) return new Response(JSON.stringify({ error: "domain_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: domain } = await svc.from("kubo_domains").select("*").eq("id", domain_id).eq("user_id", userId).maybeSingle();
    if (!domain) return new Response(JSON.stringify({ error: "domain not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "list") {
      const { data: records } = await svc.from("kubo_dns_records").select("*").eq("domain_id", domain_id).order("created_at", { ascending: true });
      return new Response(JSON.stringify({ records: records ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const rec = body?.record ?? {};
      const type = String(rec?.type ?? "").toUpperCase();
      if (!VALID_TYPES.includes(type)) return new Response(JSON.stringify({ error: "invalid_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const name = String(rec?.name ?? "@").trim();
      const value = String(rec?.value ?? "").trim();
      const ttl = Math.max(60, Math.min(86400, Number(rec?.ttl ?? 3600) | 0));
      const priority = rec?.priority != null ? Number(rec.priority) : null;
      if (!value) return new Response(JSON.stringify({ error: "value required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const ionos_record_id = apiKey
        ? await ionosCreate(apiKey, domain.domain_name, { name, type, value, ttl, priority })
        : null;

      const { data: row, error } = await svc.from("kubo_dns_records").insert({
        domain_id, user_id: userId, record_type: type, name, value, ttl, priority, ionos_record_id,
      }).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ record: row, synced: !!ionos_record_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const id = String(body?.record_id ?? "");
      const { error } = await svc.from("kubo_dns_records").delete().eq("id", id).eq("user_id", userId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
