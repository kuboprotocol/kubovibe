// KUBO Cloud Sessions — remote ephemeral workspace lifecycle for the iOS/iPadOS Mobile Agent.
// No code ever runs on the device: this function creates, bills, heartbeats and terminates
// remote containers. The client is only a rich viewer (editor + chat + terminal + preview).
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, supaAdmin, sanitizeError, deductCredits } from "../_shared/creative.ts";
import { apnsConfigured, sendApnsToUser } from "../_shared/apns.ts";
import {
  orchestratorDriver,
  provisionContainer,
  execInContainer,
  destroyContainer,
} from "../_shared/orchestrator.ts";

/** Human label for a native target, used in push alerts. */
function archLabelFor(arch: string): string {
  return arch.replace(/-/g, " ").toUpperCase();
}


const CREDITS_PER_MINUTE = 1;
const ACTION_COSTS: Record<string, number> = { build: 2, deploy: 4 };

/** Native compilation targets. Heavier toolchains (Xcode, MSVC, NDK) cost more. */
const ARCH_MULTIPLIERS: Record<string, number> = {
  "web": 1,
  "ios-arm64": 2.5,
  "ios-simulator-x64": 1.5,
  "android-arm64": 2,
  "android-x64": 1.5,
  "macos-universal": 2.5,
  "windows-x64": 2,
  "linux-x64": 1.5,
};
const ARCH_PLATFORM: Record<string, string> = {
  "web": "web",
  "ios-arm64": "ios",
  "ios-simulator-x64": "ios",
  "android-arm64": "android",
  "android-x64": "android",
  "macos-universal": "macos",
  "windows-x64": "windows",
  "linux-x64": "linux",
};
const DEFAULT_IDLE_TIMEOUT = 900; // 15 min
const GRACE_WINDOW_SECONDS = 60;

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

    // Admins may operate on any session (admin cloud dashboard); everyone else is scoped to their own.
    const { data: isAdminRow } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isAdmin = isAdminRow === true;

    let sessionQuery = admin.from("cloud_sessions").select("*").eq("id", sessionId);
    if (!isAdmin) sessionQuery = sessionQuery.eq("user_id", user.id);
    const { data: session, error: loadError } = await sessionQuery.maybeSingle();
    if (loadError) throw loadError;
    if (!session) return json({ error: "session_not_found" }, 404);

    // Cost always lands on the session owner's ledger, even when an admin triggers the run.
    const billedUserId = session.user_id as string;

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

    // ---------- build / deploy (real execution + ledger charge) ----------
    if (action === "build" || action === "deploy") {
      if (session.status === "terminated") return json({ error: "session_terminated" }, 409);

      const kind = action;
      const arch = String((body as any).arch ?? "web");
      if (!(arch in ARCH_MULTIPLIERS)) return json({ error: "unknown_arch" }, 400);
      const platform = ARCH_PLATFORM[arch];
      const cost = Math.round(ACTION_COSTS[kind] * ARCH_MULTIPLIERS[arch] * 100) / 100;
      const command = String((body as any).command ?? (kind === "build" ? "npm run build" : "npm run deploy")).slice(0, 300);

      // Charge before running — no free compute.
      const charge = await deductCredits(billedUserId, cost, "cloud_session", {
        session_id: session.id,
        kind,
        command,
        arch,
        platform,
        triggered_by: user.id,
      }, user.email, `cloud_session:${session.id}:${kind}:${arch}:${Date.now()}`);
      if (!charge.ok) return json({ error: "insufficient_credits" }, 402);

      const { data: build, error: buildError } = await admin
        .from("session_builds")
        .insert({
          session_id: session.id,
          user_id: billedUserId,
          project_id: session.project_id,
          kind,
          arch,
          platform,
          status: "running",
          command,
          credits_spent: cost,
          logs: `$ ${command}\n`,
        })
        .select()
        .single();
      if (buildError) throw buildError;

      await admin.from("cloud_sessions").update({
        credits_spent: Number(session.credits_spent) + cost,
        last_activity_at: new Date().toISOString(),
        status: "running",
      }).eq("id", session.id);

      const startedAt = Date.now();
      let status = "succeeded";
      let logs = `$ ${command}\n`;
      let previewUrl: string | null = session.preview_url;
      let errorMessage: string | null = null;

      try {
        const driver = orchestratorDriver();
        if (!driver) throw new Error("orchestrator_not_configured");
        const result = await execInContainer(session.container_ref, command, kind);
        logs += result.logs;
        previewUrl = result.preview_url ?? previewUrl;
        if (result.exit_code !== 0) {
          status = "failed";
          errorMessage = `exit_code_${result.exit_code}`;
        }
      } catch (err) {
        status = "failed";
        errorMessage = sanitizeError(err);
        logs += `\n${errorMessage}`;
      }

      const { data: finished } = await admin
        .from("session_builds")
        .update({
          status,
          logs: logs.slice(0, 20000),
          preview_url: previewUrl,
          error_message: errorMessage,
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        })
        .eq("id", build.id)
        .select()
        .single();

      if (previewUrl && previewUrl !== session.preview_url) {
        await admin.from("cloud_sessions").update({ preview_url: previewUrl }).eq("id", session.id);
      }

      // Ring the phone: the user usually backgrounds the app during a native build.
      try {
        if (apnsConfigured()) {
          const results = await sendApnsToUser(admin, billedUserId, {
            title: status === "succeeded" ? `${kind} succeeded` : `${kind} failed`,
            body: `${archLabelFor(arch)} · ${cost} credits · ${Math.round((Date.now() - startedAt) / 1000)}s`,
            data: {
              build_id: build.id,
              session_id: session.id,
              project_id: session.project_id,
              arch,
              status,
              deeplink: `kubovibe://m?session=${session.id}&build=${build.id}`,
            },
            threadId: session.id,
          }, { collapseId: `build-${build.id}` });

          if (results.length) {
            await admin.from("push_deliveries").insert(
              results.map((r) => ({
                user_id: billedUserId,
                triggered_by: user.id,
                kind: `${kind}_${status}`,
                title: status === "succeeded" ? `${kind} succeeded` : `${kind} failed`,
                body: `${arch} · ${cost} credits`,
                status: r.ok ? "delivered" : "failed",
                apns_id: r.apnsId,
                error_reason: r.reason,
                metadata: { build_id: build.id, session_id: session.id, http_status: r.status },
              })),
            );
          }
        }
      } catch (pushErr) {
        console.error("[cloud-sessions] push failed", pushErr);
      }

      return json({ build: finished, charged: cost, preview_url: previewUrl });

    }

    // ---------- builds history ----------
    if (action === "builds") {
      const { data, error } = await admin
        .from("session_builds")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return json({ builds: data ?? [] });
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
