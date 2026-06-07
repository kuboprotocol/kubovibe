// Health check de todos os agentes registrados.
// Faz HEAD/OPTIONS em cada edge function e mede latência. Retorna sumário.
import { corsHeaders } from "../_shared/agentRuntime.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

async function pingFunction(name: string): Promise<{ ok: boolean; status: number; latency_ms: number; error?: string }> {
  const started = Date.now();
  try {
    // OPTIONS responde corsHeaders sem cobrar créditos
    const r = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
        Origin: "https://kubovibe.dev",
      },
    });
    await r.text().catch(() => "");
    return { ok: r.status >= 200 && r.status < 500, status: r.status, latency_ms: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, latency_ms: Date.now() - started, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // valida JWT — mas não exige role admin (qualquer usuário autenticado pode ver saúde do sistema)
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) {
    return new Response(JSON.stringify({ error: "missing_authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: agents } = await admin
    .from("agent_registry")
    .select("slug, name, edge_function, category, credit_cost, status")
    .neq("status", "disabled")
    .order("category", { ascending: true });

  const list = (agents ?? []) as Array<{ slug: string; name: string; edge_function: string; category: string; credit_cost: number; status: string }>;

  // pinga em paralelo (timeout natural via fetch)
  const results = await Promise.all(list.map(async (a) => {
    const ping = await pingFunction(a.edge_function);
    return {
      slug: a.slug,
      name: a.name,
      category: a.category,
      edge_function: a.edge_function,
      credit_cost: a.credit_cost,
      registry_status: a.status,
      health: ping.ok ? "healthy" : "unhealthy",
      http_status: ping.status,
      latency_ms: ping.latency_ms,
      error: ping.error ?? null,
    };
  }));

  const total = results.length;
  const healthy = results.filter((r) => r.health === "healthy").length;
  const avgLatency = total > 0 ? Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / total) : 0;

  return new Response(JSON.stringify({
    ok: true,
    checked_at: new Date().toISOString(),
    summary: { total, healthy, unhealthy: total - healthy, avg_latency_ms: avgLatency },
    agents: results,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
