import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { assertFrontendEnv } from "./lib/envCheck";
import { toast } from "sonner";
import { Button } from "./components/ui/button";

assertFrontendEnv();

const TELEMETRY_LS_KEY = 'kubo:pwa:telemetry';
const MUTE_LS_KEY = 'kubo:pwa:mute_toasts';

const loadTelemetry = (): Record<string, number> => {
  try {
    const saved = localStorage.getItem(TELEMETRY_LS_KEY);
    return saved ? JSON.parse(saved) : { image: 0, svg: 0, font: 0, other: 0 };
  } catch {
    return { image: 0, svg: 0, font: 0, other: 0 };
  }
};

const pwaTelemetry = loadTelemetry();
let ignorePwaToasts = localStorage.getItem(MUTE_LS_KEY) === 'true';

// Helper to expose telemetry globally for export
(window as any).__exportPWATelemetry = () => {
  const data = JSON.stringify(pwaTelemetry, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pwa-telemetry-\${new Date().toISOString()}.json`;
  a.click();
  console.log('Telemetry exported:', pwaTelemetry);
};

// Listen for PWA asset fallback events
if (typeof window !== 'undefined') {
  window.addEventListener('pwa:asset-fallback', (e: any) => {
    const { type, url } = e.detail;
    
    // Telemetry update
    const category = type === 'image' ? (url?.endsWith('.svg') ? 'svg' : 'image') : (type === 'font' ? 'font' : 'other');
    pwaTelemetry[category]++;
    localStorage.setItem(TELEMETRY_LS_KEY, JSON.stringify(pwaTelemetry));
    
    console.log(`[PWA Telemetry] Fallback triggered: \${category}. Total for category: \${pwaTelemetry[category]}`, { url });

    if (ignorePwaToasts) return;

    toast.info(`Offline Mode: Asset (\${type}) replaced`, {
      description: `Usando placeholder para: \${url?.split('/').pop()}`,
      duration: 5000,
      id: `pwa-fallback-\${type}`, 
      action: {
        label: "Silenciar",
        onClick: () => {
          ignorePwaToasts = true;
          localStorage.setItem(MUTE_LS_KEY, 'true');
          toast.dismiss();
          toast.success("Avisos offline silenciados para esta sessão.");
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
      // Potentially font/css related
      window.dispatchEvent(new CustomEvent('pwa:asset-fallback', {
        detail: { type: 'font', url }
      }));
    }
  }, true);
}

createRoot(document.getElementById("root")!).render(<App />);