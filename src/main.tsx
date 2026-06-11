import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { assertFrontendEnv } from "./lib/envCheck";
import { toast } from "sonner";

assertFrontendEnv();

// Listen for PWA asset fallback events
if (typeof window !== 'undefined') {
  window.addEventListener('pwa:asset-fallback', (e: any) => {
    const { type, url } = e.detail;
    toast.info(`Offline Mode: Asset (${type}) replaced with placeholder`, {
      description: `URL: ${url?.split('/').pop()}`,
      duration: 3000,
    });
  });
  
  // Intercepting network failures for assets to trigger the event manually
  // if the Service Worker doesn't handle the fallback perfectly (e.g. initial load)
  window.addEventListener('error', (e: ErrorEvent) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLImageElement || target instanceof HTMLSourceElement) {
      window.dispatchEvent(new CustomEvent('pwa:asset-fallback', {
        detail: { type: 'image', url: (target as any).src || (target as any).srcset }
      }));
    }
  }, true);
}

createRoot(document.getElementById("root")!).render(<App />);