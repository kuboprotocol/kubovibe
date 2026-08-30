import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CloudSession {
  id: string;
  project_id: string;
  container_ref: string;
  status: "starting" | "running" | "idle" | "terminated";
  preview_url: string | null;
  terminal_url: string | null;
  idle_timeout_seconds: number;
  billed_minutes: number;
  credits_spent: number;
  started_at: string;
  last_activity_at: string;
  terminated_at: string | null;
}

const HEARTBEAT_MS = 60_000;

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cloud-sessions", { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/**
 * Remote workspace session client. Nothing runs locally: this hook only opens,
 * keeps alive (billing tick) and closes an ephemeral container in KUBO Cloud.
 */
export function useCloudSession() {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [sessions, setSessions] = useState<CloudSession[]>([]);
  const [loading, setLoading] = useState(false);
  const activeRef = useRef(true);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await invoke<{ sessions: CloudSession[] }>({ action: "list" });
      setSessions(res.sessions);
      const live = res.sessions.find((s) => s.status !== "terminated") ?? null;
      setSession(live);
    } catch {
      /* silent — panel shows empty state */
    }
  }, []);

  const start = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const res = await invoke<{ session: CloudSession }>({ action: "create", project_id: projectId });
      setSession(res.session);
      await refresh();
      toast.success("Remote workspace ready");
      return res.session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      toast.error(msg === "insufficient_credits" ? "Not enough credits to start a session" : "Could not start session");
      return null;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const terminate = useCallback(async (sessionId?: string) => {
    const id = sessionId ?? session?.id;
    if (!id) return;
    setLoading(true);
    try {
      await invoke({ action: "terminate", session_id: id });
      setSession(null);
      await refresh();
      toast.success("Session terminated");
    } catch {
      toast.error("Could not terminate session");
    } finally {
      setLoading(false);
    }
  }, [session?.id, refresh]);

  // Billing heartbeat — charges only real running minutes, stops when idle.
  useEffect(() => {
    if (!session || session.status === "terminated") return;

    const onVisibility = () => { activeRef.current = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVisibility);

    const tick = async () => {
      try {
        const res = await invoke<{ status: string; reason?: string; warning?: string }>({
          action: "heartbeat",
          session_id: session.id,
          active: activeRef.current,
        });
        if (res.status === "terminated") {
          toast.message("Session closed due to inactivity");
          setSession(null);
          await refresh();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("insufficient_credits")) {
          toast.error("Out of credits — session closing in 60s");
          window.setTimeout(() => terminate(session.id), 60_000);
        }
      }
    };

    timerRef.current = window.setInterval(tick, HEARTBEAT_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [session, refresh, terminate]);

  useEffect(() => { refresh(); }, [refresh]);

  return { session, sessions, loading, start, terminate, refresh };
}
