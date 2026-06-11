import { supabase } from "@/integrations/supabase/client";

export type TelemetryEventType = "image" | "svg" | "font" | "other";

export type TelemetryEvent = {
  id: string;
  timestamp: string;
  type: TelemetryEventType;
  url: string;
  sessionId: string;
  canvasId?: string | null;
  userId?: string | null;
};

const TELEMETRY_KEY = "kubo:pwa:telemetry_events";

const getSessionId = () => {
  let sid = sessionStorage.getItem("kubo:pwa:session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("kubo:pwa:session_id", sid);
  }
  return sid;
};

export const getTelemetryEvents = (): TelemetryEvent[] => {
  try {
    const saved = localStorage.getItem(TELEMETRY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveTelemetryEvent = (
  event: Omit<TelemetryEvent, "id" | "timestamp" | "sessionId">,
) => {
  const events = getTelemetryEvents();
  const newEvent: TelemetryEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
  };
  events.push(newEvent);
  localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events.slice(-2000)));

  // Best-effort server ingest (auth required by RLS — silently skips when logged out)
  void ingestRemote(newEvent);
  return newEvent;
};

async function ingestRemote(e: TelemetryEvent) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("pwa_telemetry_events").insert({
      user_id: auth.user.id,
      session_id: e.sessionId,
      canvas_id: e.canvasId ?? null,
      type: e.type,
      url: e.url,
    });
  } catch {
    /* swallow */
  }
}

export const clearTelemetry = () => {
  localStorage.removeItem(TELEMETRY_KEY);
};

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportTelemetryAsJSON = (events: TelemetryEvent[]) =>
  download(
    new Blob([JSON.stringify(events, null, 2)], { type: "application/json" }),
    `pwa-telemetry-${new Date().toISOString()}.json`,
  );

export const exportTelemetryAsCSV = (events: TelemetryEvent[]) => {
  if (events.length === 0) return;
  const headers = ["id", "timestamp", "type", "url", "sessionId", "canvasId", "userId"];
  const rows = events.map((e) =>
    [e.id, e.timestamp, e.type, e.url, e.sessionId, e.canvasId ?? "", e.userId ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  download(
    new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" }),
    `pwa-telemetry-${new Date().toISOString()}.csv`,
  );
};

/** Single-tab CSRF token, regenerated on demand. */
export function getCsrfToken() {
  let t = sessionStorage.getItem("kubo:pwa:csrf");
  if (!t) {
    t = crypto.randomUUID() + "-" + crypto.randomUUID();
    sessionStorage.setItem("kubo:pwa:csrf", t);
  }
  return t;
}
