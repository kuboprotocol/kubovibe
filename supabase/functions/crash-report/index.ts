// crash-report: receives client-side crash reports from ErrorBoundary and stores them.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_STR = 8000;
const MAX_STACK = 20000;

function clip(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length > max ? s.slice(0, max) + "…[truncated]" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const message = clip(payload.message, MAX_STR);
  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Optional: derive user_id from bearer token if present
  let userId: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    try {
      const supa = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } }
      );
      const { data } = await supa.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      /* ignore — anonymous is allowed */
    }
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const row = {
    user_id: userId,
    resource: clip(payload.resource, 256),
    route: clip(payload.route, 512),
    message,
    stack: clip(payload.stack, MAX_STACK),
    component_stack: clip(payload.componentStack, MAX_STACK),
    user_agent: clip(payload.userAgent ?? req.headers.get("User-Agent"), 1024),
    viewport: clip(payload.viewport, 32),
    retry_count: typeof payload.retryCount === "number" ? payload.retryCount : 0,
    health: payload.health ?? null,
    metadata: payload.metadata ?? null,
  };

  const { data, error } = await admin
    .from("crash_reports")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[crash-report] insert failed:", error.message);
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[crash-report] stored", { id: data.id, userId, route: row.route });

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
