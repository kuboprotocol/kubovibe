// GET /pwa-telemetry?type=&canvasId=&userId=&sessionId=&q=&start=&end=&page=&pageSize=&sort=desc&export=csv|json&background=true&jobId=
// POST /pwa-telemetry { action: 'cancel', jobId: '...' }
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

async function notifyAnomaly(supabase: any, anomalyData: any, userId: string) {
  const { data: settings } = await supabase
    .from("pwa_telemetry_settings")
    .select("webhook_url, is_notifications_enabled")
    .eq("user_id", userId)
    .single();

  if (settings?.is_notifications_enabled && settings?.webhook_url) {
    try {
      await fetch(settings.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pwa_telemetry_anomaly",
          timestamp: new Date().toISOString(),
          data: anomalyData,
        }),
      });
    } catch (e) {
      console.error("Failed to send webhook notification:", e);
    }
  }
}

async function sendJobFailureEmail(admin: any, userId: string, jobId: string, errorMessage: string) {
  try {
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) return;
    await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email,
        from: "Kubo Vibe <noreply@kubovibe.dev>",
        subject: "Falha na exportação de telemetria PWA",
        purpose: "transactional",
        html: `<div style="font-family:sans-serif;padding:20px"><h2>Sua exportação falhou</h2><p>O job <code>${jobId}</code> falhou ao processar.</p><p><strong>Erro:</strong> ${String(errorMessage).slice(0, 500)}</p><p>Você pode reexecutar pela aba <strong>Jobs</strong> em PWA Telemetry.</p></div>`,
      },
    });
  } catch (e) {
    console.error("Failed to send failure email:", e);
  }
}

function buildEventsQuery(admin: any, f: any) {
  let q = admin.from("pwa_telemetry_events").select("*");
  if (f.type && f.type !== "all") q = q.eq("type", f.type);
  if (f.canvasId) q = q.eq("canvas_id", f.canvasId);
  if (f.filterUser) q = q.eq("user_id", f.filterUser);
  if (f.sessionId) q = q.eq("session_id", f.sessionId);
  if (f.start) q = q.gte("created_at", f.start);
  if (f.end) q = q.lte("created_at", f.end);
  if (f.q) q = q.or(`url.ilike.%${f.q}%,session_id.ilike.%${f.q}%,canvas_id.ilike.%${f.q}%`);
  return q.order("created_at", { ascending: false });
}

async function runBackgroundExport(admin: any, userId: string, job: any) {
  try {
    const exportFmt = job.format;
    const headers = ["id", "created_at", "type", "url", "session_id", "canvas_id", "user_id"];
    let content = exportFmt === "csv" ? headers.join(",") + "\n" : "[\n";
    let exportedCount = 0;
    const CHUNK_SIZE = 1000;
    const MAX_EXPORT = 50000;

    for (let offset = 0; offset < MAX_EXPORT; offset += CHUNK_SIZE) {
      const { data: currentJob } = await admin
        .from("pwa_telemetry_export_jobs").select("status").eq("id", job.id).single();
      if (currentJob?.status === "cancelled") return;

      const { data: chunk, error: chunkErr } = await buildEventsQuery(admin, job.filters || {}).range(offset, offset + CHUNK_SIZE - 1);
      if (chunkErr) throw chunkErr;
      if (!chunk || chunk.length === 0) break;

      exportedCount += chunk.length;
      const progress = Math.min(95, Math.round((exportedCount / MAX_EXPORT) * 100));
      await admin.from("pwa_telemetry_export_jobs").update({ progress }).eq("id", job.id);

      if (exportFmt === "csv") {
        content += chunk.map((r: any) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n") + "\n";
      } else {
        content += chunk.map((r: any) => JSON.stringify(r)).join(",\n") + ",\n";
      }
      if (chunk.length < CHUNK_SIZE) break;
    }
    if (exportFmt === "json") content = content.replace(/,\n$/, "") + "\n]";

    const path = `pwa-telemetry/${userId}/${job.id}.${exportFmt}`;
    const contentType = exportFmt === "csv" ? "text/csv" : "application/json";
    const { error: upErr } = await admin.storage.from("uploads").upload(path, new Blob([content], { type: contentType }), { upsert: true, contentType });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await admin.storage.from("uploads").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr) throw signErr;

    await admin.from("pwa_telemetry_export_jobs")
      .update({ status: "completed", progress: 100, result_url: signed.signedUrl })
      .eq("id", job.id);
  } catch (e) {
    console.error("Background export failed:", e);
    const msg = String((e as Error).message ?? e);
    await admin.from("pwa_telemetry_export_jobs")
      .update({ status: "failed", error_message: msg }).eq("id", job.id);
    await sendJobFailureEmail(admin, userId, job.id, msg);
  }
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

    // Role check via service role
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

    // Handle POST requests (Cancellation, etc.)
    if (req.method === "POST") {
      const body = await req.json();
      if (body.action === "cancel" && body.jobId) {
        await admin
          .from("pwa_telemetry_export_jobs")
          .update({ status: "cancelled" })
          .eq("id", body.jobId)
          .eq("user_id", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Toggle notifications
      if (body.action === "toggle_notifications") {
        const { error } = await admin
          .from("pwa_telemetry_settings")
          .upsert({
            user_id: userId,
            is_notifications_enabled: body.enabled,
            webhook_url: body.webhookUrl,
          }, { onConflict: 'user_id' });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Retry a failed job
      if (body.action === "retry" && body.jobId) {
        const { data: orig, error: orErr } = await admin
          .from("pwa_telemetry_export_jobs")
          .select("*").eq("id", body.jobId).eq("user_id", userId).single();
        if (orErr || !orig) {
          return new Response(JSON.stringify({ error: "job_not_found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: newJob, error: njErr } = await admin
          .from("pwa_telemetry_export_jobs")
          .insert({
            user_id: userId,
            status: "processing",
            format: orig.format,
            filters: orig.filters,
            progress: 0,
          }).select().single();
        if (njErr) throw njErr;
        await admin.from("pwa_telemetry_audit_logs").insert({
          actor_id: userId,
          action_type: "export",
          filters: { ...newJob.filters, format: newJob.format, mode: "retry", originalJobId: orig.id, jobId: newJob.id },
        });
        (async () => { await runBackgroundExport(admin, userId, newJob); })();
        return new Response(JSON.stringify({ jobId: newJob.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const url = new URL(req.url);
    const p = url.searchParams;
    
    // Status polling
    const jobIdParam = p.get("jobId");
    if (jobIdParam) {
      const { data: job } = await admin
        .from("pwa_telemetry_export_jobs")
        .select("*")
        .eq("id", jobIdParam)
        .eq("user_id", userId)
        .single();
      return new Response(JSON.stringify({ job }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sigma = parseFloat(p.get("sigma") ?? "2");
    if (isNaN(sigma) || sigma < 0.1 || sigma > 10) {
      return new Response(JSON.stringify({ error: "invalid_sigma", message: "Sigma must be between 0.1 and 10" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = roles.includes("admin");
    const appliedSigma = isAdmin ? sigma : 2.0;

    const type = p.get("type");
    const canvasId = p.get("canvasId");
    const filterUser = p.get("userId");
    const sessionId = p.get("sessionId");
    const q = p.get("q");
    const start = p.get("start");
    const end = p.get("end");
    const sort = p.get("sort") === "asc" ? "asc" : "desc";
    const exportFmt = p.get("export"); // csv | json
    const background = p.get("background") === "true";
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
      if (background) {
        const { data: job, error: jobErr } = await admin
          .from("pwa_telemetry_export_jobs")
          .insert({
            user_id: userId,
            status: "processing",
            format: exportFmt,
            filters: { type, canvasId, filterUser, sessionId, q, start, end }
          })
          .select()
          .single();
        if (jobErr) throw jobErr;
        
        // Audit background export
        await admin.from("pwa_telemetry_audit_logs").insert({
          actor_id: userId,
          action_type: "export",
          filters: { ...job.filters, format: job.format, mode: "background", jobId: job.id }
        });

        // Start processing in background using shared helper (uploads to storage + emails on failure)
        (async () => { await runBackgroundExport(admin, userId, job); })();

        return new Response(JSON.stringify({ jobId: job.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sync Export (Original)
      const startTime = Date.now();
      const headers = ["id", "created_at", "type", "url", "session_id", "canvas_id", "user_id"];
      let csvContent = exportFmt === "csv" ? headers.join(",") + "\n" : "[\n";
      let exportedCount = 0;
      const CHUNK_SIZE = 1000;
      const MAX_EXPORT = 50000;
      
      for (let offset = 0; offset < MAX_EXPORT; offset += CHUNK_SIZE) {
        const { data: chunk, error: chunkErr } = await query.range(offset, offset + CHUNK_SIZE - 1);
        if (chunkErr) throw chunkErr;
        if (!chunk || chunk.length === 0) break;
        exportedCount += chunk.length;
        if (exportFmt === "csv") {
          csvContent += chunk.map((r: any) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n") + "\n";
        } else {
          csvContent += chunk.map((r: any) => JSON.stringify(r)).join(",\n") + (exportedCount < MAX_EXPORT ? ",\n" : "");
        }
        if (chunk.length < CHUNK_SIZE) break;
      }
      if (exportFmt === "json") csvContent = csvContent.replace(/,\n$/, "") + "\n]";

      await admin.from("pwa_telemetry_metrics").insert({
        operation: "export",
        duration_ms: Date.now() - startTime,
        row_count: exportedCount,
        filters: { type, canvasId, filterUser, sessionId, q, start, end },
        user_id: userId
      });

      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          "Content-Type": exportFmt === "csv" ? "text/csv" : "application/json",
          "Content-Disposition": `attachment; filename="pwa-telemetry-${Date.now()}.${exportFmt}"`,
        },
      });
    }

    const listStartTime = Date.now();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: rows, count, error } = await query.range(from, to);
    if (error) throw error;

    // Log list metrics
    await admin.from("pwa_telemetry_metrics").insert({
      operation: "list",
      duration_ms: Date.now() - listStartTime,
      row_count: rows?.length ?? 0,
      filters: { type, canvasId, filterUser, sessionId, q, start, end, page },
      user_id: userId
    });
    
    // Aggregation and Anomaly Detection
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

    // Basic Anomaly Logic (same as UI but on server)
    const eligible = summary.filter((s: any) => s.count >= 5);
    if (eligible.length >= 3) {
      const counts = eligible.map((s: any) => s.count);
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
      const sd = Math.sqrt(variance);
      const threshold = mean + appliedSigma * sd;
      const anomalous = eligible.filter((s: any) => s.count > threshold);
      if (anomalous.length > 0) {
        await notifyAnomaly(admin, { anomalous, threshold, mean }, userId);
      }
    }

    return new Response(JSON.stringify({
      events: rows ?? [],
      page, pageSize, total: count ?? 0,
      isCapped: (count ?? 0) > 10000,
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
