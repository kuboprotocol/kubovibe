// KUBO Cloud Sessions — remote ephemeral workspace lifecycle for the iOS/iPadOS Mobile Agent.
// No code ever runs on the device: this function creates, bills, heartbeats and terminates
// remote containers. The client is only a rich viewer (editor + chat + terminal + preview).
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, supaAdmin, sanitizeError, deductCredits } from "../_shared/creative.ts";

const CREDITS_PER_MINUTE = 1;
const ACTION_COSTS: Record<string, number> = { build: 2, deploy: 4 };
const DEFAULT_IDLE_TIMEOUT = 900; // 15 min
const GRACE_WINDOW_SECONDS = 60;

const CONTAINER_API_URL = Deno.env.get("KUBO_CONTAINER_API_URL");
const CONTAINER_API_KEY = Deno.env.get("KUBO_CONTAINER_API_KEY");

type Provisioned = {
  container_ref: string;
  preview_url: string | null;
  terminal_url: string | null;
};

/** Provision a remote container. Falls back to a reserved placeholder when the
 * container orchestrator is not configured yet, so the session lifecycle,
 * billing and client contract can be exercised end to end. */
async function provisionContainer(sessionId: string, projectId: string, userId: string): Promise<Provisioned> {
  if (CONTAINER_API_URL && CONTAINER_API_KEY) {
    const res = await fetch(`${CONTAINER_API_URL}/containers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONTAINER_API_KEY}` },
      body: JSON.stringify({ session_id: sessionId, project_id: projectId, user_id: userId }),
    });
    if (!res.ok) throw new Error("container_provision_failed");
    const data = await res.json();
    return {
      container_ref: String(data.container_ref ?? data.id),
      preview_url: data.preview_url ?? null,
      terminal_url: data.terminal_url ?? null,
    };
  }
  return { container_ref: `pending:${sessionId}`, preview_url: null, terminal_url: null };
}

async function destroyContainer(containerRef: string) {
  if (!CONTAINER_API_URL || !CONTAINER_API_KEY) return;
  if (containerRef.startsWith("pending:")) return;
  try {
    await fetch(`${CONTAINER_API_URL}/containers/${encodeURIComponent(containerRef)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CONTAINER_API_KEY}` },
    });
  } catch (err) {
    console.error("[cloud-sessions] destroy failed", err);
  }
}

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
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = String((body as any).action ?? (req.method === "GET" ? "list" : ""));

    // ---------- list ----------
    if (action === "list") {
      const { data, error } = await admin
        .from("cloud_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return json({ sessions: data ?? [] });
    }

    // ---------- create ----------
    if (action === "create") {
      const projectId = String((body as any).project_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ error: "invalid_project_id" }, 400);

      // Charge the first minute up front — never start a container without credit coverage.
      const first = await deductCredits(user.id, CREDITS_PER_MINUTE, "cloud_session", {
        project_id: projectId,
        kind: "startup_minute",
      }, user.email);
      if (!first.ok) return json({ error: "insufficient_credits" }, 402);

      const { data: created, error } = await admin
        .from("cloud_sessions")
        .insert({
          user_id: user.id,
          project_id: projectId,
          container_ref: "provisioning",
          status: "starting",
          idle_timeout_seconds: DEFAULT_IDLE_TIMEOUT,
          billed_minutes: 1,
          credits_spent: CREDITS_PER_MINUTE,
        })
        .select()
        .single();
      if (error) throw error;

      let provisioned: Provisioned;
      try {
        provisioned = await provisionContainer(created.id, projectId, user.id);
      } catch (err) {
        await admin.from("cloud_sessions")
          .update({ status: "terminated", terminated_at: new Date().toISOString() })
          .eq("id", created.id);
        throw err;
      }

      const { data: session } = await admin
        .from("cloud_sessions")
        .update({
          container_ref: provisioned.container_ref,
          preview_url: provisioned.preview_url,
          terminal_url: provisioned.terminal_url,
          status: "running",
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", created.id)
        .select()
        .single();

      return json({ session, credits_per_minute: CREDITS_PER_MINUTE });
    }

    const sessionId = String((body as any).session_id ?? "");
    if (!sessionId) return json({ error: "session_id_required" }, 400);

    const { data: session, error: loadError } = await admin
      .from("cloud_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!session) return json({ error: "session_not_found" }, 404);

    // ---------- heartbeat (billing tick) ----------
    if (action === "heartbeat") {
      if (session.status === "terminated") return json({ error: "session_terminated" }, 409);

      const now = Date.now();
      const idleMs = now - new Date(session.last_activity_at).getTime();
      const activeClient = (body as any).active !== false;

      // Idle sessions are never billed — they are shut down instead.
      if (!activeClient || idleMs > session.idle_timeout_seconds * 1000) {
        await destroyContainer(session.container_ref);
        await admin.from("cloud_sessions").update({
          status: "terminated",
          terminated_at: new Date().toISOString(),
        }).eq("id", session.id);
        return json({ status: "terminated", reason: "idle_timeout" });
      }

      const elapsedMinutes = Math.floor((now - new Date(session.started_at).getTime()) / 60000) + 1;
      const owed = Math.max(0, elapsedMinutes - session.billed_minutes);

      if (owed > 0) {
        const charge = await deductCredits(user.id, owed * CREDITS_PER_MINUTE, "cloud_session", {
          session_id: session.id,
          project_id: session.project_id,
          minutes: owed,
        }, user.email, `cloud_session:${session.id}:min:${elapsedMinutes}`);

        if (!charge.ok) {
          // Grace window: warn once, then terminate on the next uncovered heartbeat.
          const graceStartedMs = now - new Date(session.last_activity_at).getTime();
          if (session.status === "idle" && graceStartedMs > GRACE_WINDOW_SECONDS * 1000) {
            await destroyContainer(session.container_ref);
            await admin.from("cloud_sessions").update({
              status: "terminated",
              terminated_at: new Date().toISOString(),
            }).eq("id", session.id);
            return json({ status: "terminated", reason: "insufficient_credits" }, 402);
          }
          if (session.status !== "idle") {
            await admin.from("cloud_sessions")
              .update({ status: "idle", last_activity_at: new Date().toISOString() })
              .eq("id", session.id);
          }
          return json({
            status: "grace",
            warning: "insufficient_credits",
            grace_seconds: GRACE_WINDOW_SECONDS,
          }, 402);
        }


        await admin.from("cloud_sessions").update({
          billed_minutes: elapsedMinutes,
          credits_spent: Number(session.credits_spent) + owed * CREDITS_PER_MINUTE,
          status: "running",
          last_activity_at: new Date().toISOString(),
        }).eq("id", session.id);
      } else {
        await admin.from("cloud_sessions")
          .update({ last_activity_at: new Date().toISOString(), status: "running" })
          .eq("id", session.id);
      }

      return json({ status: "running", billed_minutes: elapsedMinutes, billed_now: owed });
    }

    // ---------- action (build / deploy) fixed cost ----------
    if (action === "charge_action") {
      const kind = String((body as any).kind ?? "");
      const cost = ACTION_COSTS[kind];
      if (!cost) return json({ error: "unknown_action_kind" }, 400);
      const charge = await deductCredits(user.id, cost, "cloud_session", {
        session_id: session.id,
        kind,
      }, user.email, `cloud_session:${session.id}:${kind}:${Date.now()}`);
      if (!charge.ok) return json({ error: "insufficient_credits" }, 402);
      await admin.from("cloud_sessions").update({
        credits_spent: Number(session.credits_spent) + cost,
        last_activity_at: new Date().toISOString(),
      }).eq("id", session.id);
      return json({ ok: true, charged: cost });
    }

    // ---------- preview ----------
    if (action === "preview") {
      if (session.status === "terminated") return json({ error: "session_terminated" }, 409);
      return json({ preview_url: session.preview_url, expires_in: 300 });
    }

    // ---------- terminate ----------
    if (action === "terminate") {
      await destroyContainer(session.container_ref);
      await admin.from("cloud_sessions").update({
        status: "terminated",
        terminated_at: new Date().toISOString(),
      }).eq("id", session.id);
      return json({ status: "terminated" });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[cloud-sessions]", err);
    return json({ error: sanitizeError(err) }, 500);
  }
});
