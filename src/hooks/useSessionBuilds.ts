import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SessionBuild {
  id: string;
  session_id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  status: string;
  command: string | null;
  logs: string;
  preview_url: string | null;
  credits_spent: number;
  duration_ms: number | null;
  error_message: string | null;
  arch: string;
  platform: string;
  created_at: string;
  finished_at: string | null;
}

/** Build/deploy runner for a remote container session. Every run is charged on the
 * credit ledger by the `cloud-sessions` edge function before execution. */
export function useSessionBuilds(sessionId?: string | null) {
  const [builds, setBuilds] = useState<SessionBuild[]>([]);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setBuilds([]);
      return;
    }
    const { data, error } = await supabase.functions.invoke("cloud-sessions", {
      body: { action: "builds", session_id: sessionId },
    });
    if (error) return;
    setBuilds(((data as { builds?: SessionBuild[] })?.builds ?? []) as SessionBuild[]);
  }, [sessionId]);

  const run = useCallback(
    async (kind: "build" | "deploy", command?: string, arch: string = "web") => {
      if (!sessionId) return null;
      setRunning(true);
      try {
        const { data, error } = await supabase.functions.invoke("cloud-sessions", {
          body: { action: kind, session_id: sessionId, command, arch },
        });
        if (error) throw new Error(error.message);
        const payload = data as { error?: string; build?: SessionBuild };
        if (payload?.error) throw new Error(payload.error);
        await refresh();
        const build = payload.build ?? null;
        if (build?.status === "succeeded") toast.success(`${kind === "build" ? "Build" : "Deploy"} finished`);
        else toast.error(build?.error_message ?? `${kind} failed`);
        return build;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "failed";
        toast.error(msg.includes("insufficient_credits") ? "Not enough credits" : `Could not run ${kind}`);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [sessionId, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime build updates for this session.
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`session-builds-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_builds", filter: `session_id=eq.${sessionId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, refresh]);

  return { builds, running, run, refresh };
}
