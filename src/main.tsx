import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { assertFrontendEnv } from "./lib/envCheck";
import { toast } from "sonner";
import { Button } from "./components/ui/button";

assertFrontendEnv();

// Telemetry state
const pwaTelemetry: Record<string, number> = {
  image: 0,
  svg: 0,
  font: 0,
  other: 0
};

let ignorePwaToasts = false;

// Listen for PWA asset fallback events
if (typeof window !== 'undefined') {
  window.addEventListener('pwa:asset-fallback', (e: any) => {
    const { type, url } = e.detail;
    
    // Telemetry update
    const category = type === 'image' ? (url?.endsWith('.svg') ? 'svg' : 'image') : (type === 'font' ? 'font' : 'other');
    pwaTelemetry[category]++;
    console.log(`[PWA Telemetry] Fallback triggered: ${category}. Total for category: ${pwaTelemetry[category]}`, { url });

    if (ignorePwaToasts) return;

    toast.info(`Offline Mode: Asset (${type}) replaced`, {
      description: `Usando placeholder para: ${url?.split('/').pop()}`,
      duration: 5000,
      id: `pwa-fallback-${type}`, // Prevent duplicates for same type
      action: {
        label: "Silenciar",
        onClick: () => {
          ignorePwaToasts = true;
          toast.dismiss();
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