import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, MinusCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ProviderStatus = {
  status: "ok" | "error" | "missing";
  latency_ms?: number;
  message?: string;
};

type Health = {
  checked_at: string;
  groq: ProviderStatus;
  openrouter: ProviderStatus;
  lovable: ProviderStatus;
  suno: ProviderStatus;
  bytez: ProviderStatus;
  moonshot: ProviderStatus;
};

const PROVIDERS: { key: keyof Omit<Health, "checked_at">; label: string; purpose: string }[] = [
  { key: "groq", label: "Groq", purpose: "Chat ultra-rápido + Whisper" },
  { key: "openrouter", label: "OpenRouter", purpose: "DeepSeek, Kimi, GPT-4o" },
  { key: "lovable", label: "Lovable AI", purpose: "Gemini + Nano Banana" },
  { key: "suno", label: "Suno", purpose: "Geração de música" },
  { key: "bytez", label: "Bytez", purpose: "SDXL (fallback imagem)" },
  { key: "moonshot", label: "Moonshot", purpose: "Kimi direto" },
];

export function ApiStatusPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-health-check`;
      const r = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const data = await r.json();
      setHealth(data);
    } catch (e) {
      console.error("api-health-check failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  return (
    <Card className="p-4 border-border/40 bg-gradient-to-br from-background/80 to-muted/20">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Status das APIs
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          </h3>
          {health?.checked_at && (
            <p className="text-[10px] text-muted-foreground">
              Verificado em {new Date(health.checked_at).toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={check} disabled={loading} className="h-8 text-xs">
          <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />
          Verificar APIs
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PROVIDERS.map(({ key, label, purpose }) => {
          const s = health?.[key];
          const status = s?.status ?? "missing";
          const Icon =
            status === "ok" ? CheckCircle2 : status === "error" ? XCircle : MinusCircle;
          const color =
            status === "ok"
              ? "text-emerald-500"
              : status === "error"
              ? "text-red-500"
              : "text-muted-foreground";
          return (
            <div key={key} className="flex items-start gap-2 p-2.5 rounded-md border border-border/30 bg-background/40">
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">{label}</span>
                  {s?.latency_ms != null && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                      {s.latency_ms}ms
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{purpose}</p>
                {s?.message && status !== "ok" && (
                  <p className="text-[9px] text-red-400/80 mt-0.5 truncate" title={s.message}>
                    {s.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
