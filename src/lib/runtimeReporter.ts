// Production runtime error reporter. Forwards uncaught errors and unhandled
// rejections to the runtime-error-beacon edge function so we have a paper
// trail when users hit a white screen in production.
//
// Disabled in dev (vite mode) to avoid noise. Beacon is fire-and-forget and
// uses navigator.sendBeacon when available for reliable transmission during
// page unload.

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
const RELEASE =
  (import.meta.env.VITE_RELEASE as string | undefined) ??
  (import.meta.env.VITE_COMMIT_SHA as string | undefined) ??
  "unknown";

const isProd = import.meta.env.PROD;
const ENDPOINT = PROJECT_ID
  ? `https://${PROJECT_ID}.supabase.co/functions/v1/runtime-error-beacon`
  : null;

// Debounce: avoid flooding when a single bug fires repeatedly
const recent = new Map<string, number>();
const DEDUP_MS = 5_000;

function shouldSend(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUP_MS) return false;
  recent.set(key, now);
  // bound the map
  if (recent.size > 50) {
    const firstKey = recent.keys().next().value;
    if (firstKey) recent.delete(firstKey);
  }
  return true;
}

type Severity = "warn" | "error" | "fatal";

export function reportRuntime(payload: {
  severity?: Severity;
  message: string;
  stack?: string | null;
  meta?: Record<string, unknown>;
}) {
  if (!ENDPOINT) return;
  const body = JSON.stringify({
    severity: payload.severity ?? "error",
    message: payload.message,
    stack: payload.stack ?? null,
    url: typeof location !== "undefined" ? location.href : null,
    release: RELEASE,
    meta: payload.meta ?? {},
  });
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow — reporting must never throw */
  }
}

let installed = false;

export function installRuntimeReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Don't ship beacons from dev — we still want console logs visible locally.
  if (!isProd) return;

  window.addEventListener("error", (e: ErrorEvent) => {
    // Asset 404s are handled by the PWA fallback path; only forward real JS errors.
    if (!(e.error || e.message)) return;
    const target = e.target as HTMLElement | null;
    if (target && (target instanceof HTMLImageElement || target instanceof HTMLLinkElement || target instanceof HTMLScriptElement)) {
      if (target !== (e.currentTarget as any)) return;
    }
    const msg = e.message || String(e.error);
    const stack = e.error?.stack ?? null;
    const key = `err:${msg}:${e.filename}:${e.lineno}`;
    if (!shouldSend(key)) return;
    // Initial render errors are fatal — escalate so deploy auto-rollback can act.
    const fatal = !document.querySelector("#root")?.firstChild;
    reportRuntime({
      severity: fatal ? "fatal" : "error",
      message: msg,
      stack,
      meta: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const msg = reason?.message ?? String(reason);
    const stack = reason?.stack ?? null;
    const key = `rej:${msg}`;
    if (!shouldSend(key)) return;
    reportRuntime({ severity: "error", message: `Unhandled rejection: ${msg}`, stack });
  });

  // Forward console.error in production so we can correlate UI bugs with logs.
  const origErr = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const msg = args.map(a => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ").slice(0, 1000);
      const stack = args.find(a => a instanceof Error)?.stack ?? null;
      const key = `cerr:${msg}`;
      if (shouldSend(key)) reportRuntime({ severity: "error", message: `console.error: ${msg}`, stack });
    } catch { /* noop */ }
    origErr(...args);
  };
}
