import * as Sentry from "@sentry/react";

// Release version (bumped per build). Falls back to a static tag when
// VITE_APP_VERSION is not injected. Correlates errors → release in Sentry.
export const APP_RELEASE =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ||
  `kubovibe@${import.meta.env.MODE}-${new Date().toISOString().slice(0, 10)}`;

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    console.info("[Sentry] DSN not configured — skipping init");
    return;
  }
  try {
    Sentry.init({
      dsn,
      release: APP_RELEASE,
      environment: import.meta.env.MODE,
      // Breadcrumbs are enabled by default (console, fetch/xhr, navigation, dom).
      // We add a small default limit tweak so long sessions don't drop too early.
      maxBreadcrumbs: 100,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.breadcrumbsIntegration({
          console: true,
          dom: true,
          fetch: true,
          history: true,
          xhr: true,
        }),
      ],
      tracesSampleRate: 0.1,
      // Avoid leaking huge PII: strip query strings from breadcrumb URLs.
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.data && typeof breadcrumb.data.url === "string") {
          try {
            const u = new URL(breadcrumb.data.url, window.location.origin);
            breadcrumb.data.url = u.origin + u.pathname;
          } catch {}
        }
        return breadcrumb;
      },
    });
    initialized = true;
    Sentry.addBreadcrumb({ category: "app", message: "Sentry initialized", level: "info" });
    console.info("[Sentry] initialized", { release: APP_RELEASE });
  } catch (e) {
    console.error("[Sentry] init failed", e);
  }
}

export function setSentryUser(user: { id: string; email?: string | null } | null) {
  if (!initialized) return;
  Sentry.setUser(user ? { id: user.id, email: user.email ?? undefined } : null);
}

export function addBreadcrumb(
  message: string,
  category = "app",
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = "info",
) {
  if (!initialized) return;
  Sentry.addBreadcrumb({ message, category, data, level });
}

export function captureBoundaryError(
  error: Error,
  info: { componentStack?: string | null; resource?: string; retryCount?: number; route?: string },
): string | undefined {
  if (!initialized) return undefined;
  return Sentry.withScope((scope) => {
    scope.setTag("boundary.resource", info.resource ?? "App");
    scope.setTag("boundary.retry", String(info.retryCount ?? 0));
    if (info.route) scope.setTag("route", info.route);
    scope.setContext("react", {
      componentStack: info.componentStack ?? "(none)",
    });
    scope.setLevel("fatal");
    return Sentry.captureException(error);
  });
}

export { Sentry };
