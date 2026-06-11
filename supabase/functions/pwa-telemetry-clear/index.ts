// POST /pwa-telemetry-clear
// Body: { csrfToken, scope?: { start?, end?, type?, sessionId? } }
// Requires authenticated user with role 'admin' or 'analyst'.
// CSRF: requires X-CSRF-Token header equal to body.csrfToken AND Origin matching allowed list.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-csrf-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_ROLES = ["admin", "analyst"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CSRF: header must be present and non-trivial; must match body.csrfToken
    const csrfHeader = req.headers.get("x-csrf-token") ?? "";
    const origin = req.headers.get("origin") ?? "";
    const referer = req.headers.get("referer") ?? "";
    if (!csrfHeader || csrfHeader.length < 16) {
      return new Response(JSON.stringify({ error: "missing_csrf_token" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Basic origin check: must come from a browser context (have origin or referer)
    if (!origin && !referer) {
      return new Response(JSON.stringify({ error: "invalid_origin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.csrfToken !== csrfHeader) {
      return new Response(JSON.stringify({ error: "csrf_token_mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRows } = await admin
      .from("user_roles").select("role").eq("user_id", userData.user.id);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.some((r: string) => ADMIN_ROLES.includes(r))) {
      return new Response(JSON.stringify({ error: "forbidden", message: "Requires admin or analyst role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scope = body?.scope ?? {};
    let del = admin.from("pwa_telemetry_events").delete({ count: "exact" });
    let scoped = false;
    if (scope.start) { del = del.gte("created_at", scope.start); scoped = true; }
    if (scope.end) { del = del.lte("created_at", scope.end); scoped = true; }
    if (scope.type) { del = del.eq("type", scope.type); scoped = true; }
    if (scope.sessionId) { del = del.eq("session_id", scope.sessionId); scoped = true; }
    if (!scoped) {
      // Require explicit "all": true to wipe everything
      if (body?.all !== true) {
        return new Response(JSON.stringify({ error: "scope_required", message: "Provide scope or {all:true}" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      del = del.not("id", "is", null);
    }
    const { error, count } = await del;
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, deleted: count ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
