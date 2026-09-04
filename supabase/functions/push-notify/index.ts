// Sends APNs alerts to the KUBO Mobile Agent and records every delivery attempt
// so the admin panel can trace pushes end to end.
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, supaAdmin, sanitizeError } from "../_shared/creative.ts";
import { apnsConfigured, sendApnsToUser, type ApnsResult } from "../_shared/apns.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUser(req.headers.get("Authorization"));
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = supaAdmin();
    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action ?? "send");

    if (action === "status") {
      const { count } = await admin
        .from("mobile_devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return json({ configured: apnsConfigured(), devices: count ?? 0 });
    }

    const title = String((body as any).title ?? "KUBO Vibe").slice(0, 120);
    const message = String((body as any).body ?? "").slice(0, 400);
    if (!message) return json({ error: "missing_body" }, 400);

    // Only admins may push to another user; everyone else pushes to themselves.
    let targetUserId = user.id;
    const requestedTarget = (body as any).user_id ? String((body as any).user_id) : null;
    if (requestedTarget && requestedTarget !== user.id) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      targetUserId = requestedTarget;
    }

    if (!apnsConfigured()) {
      return json({ error: "apns_not_configured" }, 503);
    }

    const results: ApnsResult[] = await sendApnsToUser(admin, targetUserId, {
      title,
      body: message,
      data: (body as any).data ?? {},
      threadId: (body as any).thread_id ? String((body as any).thread_id) : undefined,
    }, { collapseId: (body as any).collapse_id ? String((body as any).collapse_id) : undefined });

    if (results.length) {
      await admin.from("push_deliveries").insert(
        results.map((r) => ({
          user_id: targetUserId,
          triggered_by: user.id,
          kind: String((body as any).kind ?? "manual"),
          title,
          body: message,
          status: r.ok ? "delivered" : "failed",
          apns_id: r.apnsId,
          error_reason: r.reason,
          metadata: { http_status: r.status, ...(body as any).data ?? {} },
        })),
      );
    }

    return json({
      ok: results.some((r) => r.ok),
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map((r) => r.reason),
      devices: results.length,
    });
  } catch (err) {
    console.error("[push-notify]", err);
    return json({ error: sanitizeError(err) }, 500);
  }
});
