import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

import { assertFrontendEnv } from "./lib/envCheck";
import { toast } from "sonner";
import { clearTelemetry, getTelemetryEvents, saveTelemetryEvent } from "./utils/pwaTelemetry";
import { installRuntimeReporter, reportRuntime } from "./lib/runtimeReporter";

// Install error beacons FIRST so we catch errors thrown during boot.
installRuntimeReporter();

try {
  assertFrontendEnv();
} catch (e) {
  reportRuntime({ severity: "fatal", message: `envCheck failed: ${(e as Error).message}`, stack: (e as Error).stack });
  throw e;
}

// Intercept fetch calls to mock the telemetry API endpoint
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url;

  if (url.includes('/api/pwa/telemetry')) {
    const { supabase } = await import("./integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const events = getTelemetryEvents();
    
    if (config?.method === 'DELETE') {
      clearTelemetry();
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return originalFetch(...args);
};



const MUTE_LS_KEY = 'kubo:pwa:mute_toasts';
let ignorePwaToasts = localStorage.getItem(MUTE_LS_KEY) === 'true';

// Listen for PWA asset fallback events
if (typeof window !== 'undefined') {
  window.addEventListener('pwa:asset-fallback', (e: any) => {
    const { type, url } = e.detail;
    
    // Telemetry update
    const category = type === 'image' ? (url?.endsWith('.svg') ? 'svg' : 'image') : (type === 'font' ? 'font' : 'other');
    saveTelemetryEvent({ type: category, url: url || 'unknown' });
    
    console.log(`[PWA Telemetry] Fallback triggered: ${category}`, { url });

    if (ignorePwaToasts) return;

    toast.info(`Offline Mode: Asset (${type}) replaced`, {
      description: `Usando placeholder para: ${url?.split('/').pop()}`,
      duration: 5000,
      id: `pwa-fallback-${type}`, 
      action: {
        label: "Silenciar",
        onClick: () => {
          ignorePwaToasts = true;
          localStorage.setItem(MUTE_LS_KEY, 'true');
          toast.dismiss();
          toast.success("Avisos offline silenciados.");
        }
      },
    });
  });
  
  window.addEventListener('error', (e: ErrorEvent) => {
    const target = e.target as HTMLElement;
    const url = (target as any).src || (target as any).srcset || (target as any).href;
    
    if (target instanceof HTMLImageElement || target instanceof HTMLSourceElement) {
      window.dispatchEvent(new CustomEvent('pwa:asset-fallback', {
        detail: { type: 'image', url }
      }));
    } else if (target instanceof HTMLLinkElement && target.rel === 'stylesheet') {
      window.dispatchEvent(new CustomEvent('pwa:asset-fallback', {
        detail: { type: 'font', url }
      }));
    }
  }, true);
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary global resourceName="Root">
    <App />
  </ErrorBoundary>
);


