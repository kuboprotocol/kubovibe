import { useEffect, useRef, useState } from "react";
import { Play, Square, RefreshCw, Loader2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const E2B_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vibe-e2b-preview`;
const HEARTBEAT_MS = 60_000;

async function callE2b(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not_authenticated");
  const resp = await fetch(E2B_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error ?? `http_${resp.status}`);
  return json as {
    sessionId?: string;
    previewUrl?: string;
    creditsChargedNow?: number;
    balanceAfter?: number;
    note?: string;
  };
}

/**
 * Aba "Preview" do painel — sobe um sandbox E2B efêmero após os commits do
 * agente e mostra o resultado num iframe, na mesma tela do chat (sem sair
 * para o fluxo separado de Cloud Sessions).
 */
export function VibeLivePreview() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "stopping">("idle");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  const start = async () => {
    setStatus("starting");
    setIframeLoaded(false);
    try {
      const res = await callE2b({ action: "start" });
      setSessionId(res.sessionId ?? null);
      setPreviewUrl(res.previewUrl ?? null);
      setStatus("running");
      toast.success(`Sandbox no ar · -${res.creditsChargedNow ?? 0} créditos`, {
        description: res.note,
      });

      heartbeatRef.current = setInterval(() => {
        if (res.sessionId) void callE2b({ action: "heartbeat", sessionId: res.sessionId }).catch(() => {});
      }, HEARTBEAT_MS);
    } catch (e) {
      setStatus("idle");
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar o preview");
    }
  };

  const stop = async () => {
    if (!sessionId) return;
    setStatus("stopping");
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    try {
      const res = await callE2b({ action: "stop", sessionId });
      toast.success(`Sandbox encerrado · ${res.totalCredits ?? 0} créditos no total`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao encerrar o preview");
    } finally {
      setSessionId(null);
      setPreviewUrl(null);
      setStatus("idle");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050505]">
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground/70">
          <MonitorPlay className="h-3.5 w-3.5 text-primary" />
          Live Preview
          {status === "running" && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {status !== "running" ? (
            <Button size="sm" className="h-7 gap-1.5 text-[10px]" onClick={() => void start()} disabled={status === "starting"}>
              {status === "starting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Iniciar sandbox
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-[10px]" onClick={() => setIframeLoaded(false)}>
                <RefreshCw className="h-3 w-3" /> Recarregar
              </Button>
              <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-[10px]" onClick={() => void stop()} disabled={status === "stopping"}>
                {status === "stopping" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                Encerrar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        {!previewUrl && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground/60">
            <MonitorPlay className="h-8 w-8 opacity-40" />
            <p className="text-xs">
              Nenhum sandbox ativo. Inicie para ver seu app rodando de verdade, ao vivo.
            </p>
            <p className="text-[10px] text-muted-foreground/40">
              Cobrado por minuto do seu saldo de créditos · auto-encerra após 10min de inatividade
            </p>
          </div>
        )}

        {previewUrl && (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[#050505] text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Instalando dependências e subindo o servidor de dev…
              </div>
            )}
            <iframe
              src={previewUrl}
              title="Vibe Code Live Preview"
              className="h-full w-full border-0"
              onLoad={() => setIframeLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default VibeLivePreview;
