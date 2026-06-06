import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RunwayEndpoint =
  | "text_to_image"
  | "image_to_video"
  | "video_upscale"
  | "character_performance";

type TaskStatus = "PENDING" | "THROTTLED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

interface StartResponse {
  taskId: string;
  status: TaskStatus;
  endpoint: RunwayEndpoint;
  credits_debited: number;
  replayed: boolean;
  balance_after: number | null;
}

interface PollResponse {
  id: string;
  status: TaskStatus;
  output?: string[]; // URLs (images or videos depending on endpoint)
  failure?: string;
  failureCode?: string;
  progress?: number; // 0..1
}

export interface RunwayState {
  status: "idle" | "starting" | "polling" | "done" | "error";
  taskId: string | null;
  progress: number;
  output: string[] | null;
  error: string | null;
  creditsDebited: number;
  balanceAfter: number | null;
}

const initial: RunwayState = {
  status: "idle",
  taskId: null,
  progress: 0,
  output: null,
  error: null,
  creditsDebited: 0,
  balanceAfter: null,
};

/**
 * Hook around the `runway-generate` edge function.
 * - `generate(endpoint, payload)` debits 28 credits and starts a task.
 * - The hook then polls every 4 s until SUCCEEDED / FAILED / CANCELLED.
 * - `reset()` clears state. Polling auto-stops on unmount.
 */
export function useRunway() {
  const [state, setState] = useState<RunwayState>(initial);
  const timer = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(async (taskId: string) => {
    const { data, error } = await supabase.functions.invoke<PollResponse>(
      `runway-generate?id=${encodeURIComponent(taskId)}`,
      { method: "GET" },
    );
    if (error) {
      setState((s) => ({ ...s, status: "error", error: error.message }));
      return;
    }
    if (!data) return;

    if (data.status === "SUCCEEDED") {
      setState((s) => ({ ...s, status: "done", progress: 1, output: data.output ?? [] }));
      return;
    }
    if (data.status === "FAILED" || data.status === "CANCELLED") {
      setState((s) => ({
        ...s,
        status: "error",
        error: data.failure ?? data.failureCode ?? `Task ${data.status.toLowerCase()}`,
      }));
      return;
    }
    setState((s) => ({ ...s, status: "polling", progress: data.progress ?? s.progress }));
    timer.current = window.setTimeout(() => poll(taskId), 4000);
  }, []);

  const generate = useCallback(
    async (endpoint: RunwayEndpoint, payload: Record<string, unknown>) => {
      stopPolling();
      setState({ ...initial, status: "starting" });
      const { data, error } = await supabase.functions.invoke<StartResponse>(
        "runway-generate",
        { body: { endpoint, payload } },
      );
      if (error || !data) {
        setState((s) => ({ ...s, status: "error", error: error?.message ?? "unknown_error" }));
        return null;
      }
      setState({
        ...initial,
        status: "polling",
        taskId: data.taskId,
        creditsDebited: data.credits_debited,
        balanceAfter: data.balance_after,
      });
      void poll(data.taskId);
      return data.taskId;
    },
    [poll, stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setState(initial);
  }, [stopPolling]);

  return { state, generate, reset };
}
