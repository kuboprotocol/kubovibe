// GET /pwa-telemetry?type=&canvasId=&userId=&sessionId=&q=&start=&end=&page=&pageSize=&sort=desc&export=csv|json
// Returns paginated telemetry events, aggregated session summary, and supports filtered export.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-csrf-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const READER_ROLES = ["admin", "analyst", "viewer"];

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    const userId = userData.user.id;

    // Role check via service role (function has limited execute, but RLS policy will also enforce)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRows } = await admin
      .from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const hasReader = roles.some((r: string) => READER_ROLES.includes(r));
    if (!hasReader) {
      return new Response(JSON.stringify({ error: "forbidden", message: "Requires admin, analyst or viewer role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const p = url.searchParams;
    const sigma = parseFloat(p.get("sigma") ?? "2");
    
    // Server-side validation for sigma if the user is not admin
    const isAdmin = roles.includes("admin");
    const appliedSigma = isAdmin ? sigma : 2.0; // Enforce default for non-admins

    const type = p.get("type");
    const canvasId = p.get("canvasId");
    const filterUser = p.get("userId");
    const sessionId = p.get("sessionId");
    const q = p.get("q");
    const start = p.get("start");
    const end = p.get("end");
    const sort = p.get("sort") === "asc" ? "asc" : "desc";
    const exportFmt = p.get("export"); // csv | json
    const page = Math.max(1, parseInt(p.get("page") ?? "1"));
    const pageSize = Math.min(500, Math.max(1, parseInt(p.get("pageSize") ?? "50")));

    let query = admin.from("pwa_telemetry_events").select("*", { count: "exact" });
    if (type && type !== "all") query = query.eq("type", type);
    if (canvasId) query = query.eq("canvas_id", canvasId);
    if (filterUser) query = query.eq("user_id", filterUser);
    if (sessionId) query = query.eq("session_id", sessionId);
    if (start) query = query.gte("created_at", start);
    if (end) query = query.lte("created_at", end);
    if (q) query = query.or(`url.ilike.%${q}%,session_id.ilike.%${q}%,canvas_id.ilike.%${q}%`);
    query = query.order("created_at", { ascending: sort === "asc" });

    if (exportFmt) {
      // Hard cap export to 10k rows per request to avoid runaway
      const { data: rows, error } = await query.range(0, 9999);
      if (error) throw error;
      if (exportFmt === "csv") {
        const headers = ["id","created_at","type","url","session_id","canvas_id","user_id"];
        const lines = [headers.join(",")];
        for (const r of rows ?? []) lines.push(headers.map((h) => csvEscape((r as any)[h])).join(","));
        return new Response(lines.join("\n"), {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="pwa-telemetry-${Date.now()}.csv"`,
          },
        });
      }
      return new Response(JSON.stringify(rows ?? []), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="pwa-telemetry-${Date.now()}.json"`,
        },
      });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: rows, count, error } = await query.range(from, to);
    if (error) throw error;
    const isCapped = (count ?? 0) > 10000;

    // Aggregate session summary across the (filtered) full set up to 5k events
    const { data: aggRows } = await admin
      .from("pwa_telemetry_events")
      .select("session_id, type, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    const sessions: Record<string, any> = {};
    for (const r of aggRows ?? []) {
      const sid = (r as any).session_id;
      const ts = (r as any).created_at;
      if (!sessions[sid]) sessions[sid] = { session_id: sid, count: 0, first: ts, last: ts, types: {} };
      const s = sessions[sid];
      s.count++;
      s.types[(r as any).type] = (s.types[(r as any).type] ?? 0) + 1;
      if (new Date(ts) < new Date(s.first)) s.first = ts;
      if (new Date(ts) > new Date(s.last)) s.last = ts;
    }
    const summary = Object.values(sessions);

    return new Response(JSON.stringify({
      events: rows ?? [],
      page, pageSize, total: count ?? 0,
      isCapped,
      appliedSigma,
      summary, roles,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
