import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Send, Coins, Settings2, Info, AlertCircle, Wallet } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ToolKey = "chat" | "nano_banana" | "downloader" | "clips" | "avatar" | "shorts" | "music" | "ebook" | "emo";

interface Props {
  toolKey: ToolKey;
  onSuccess?: () => void;
}

const TOOL_CONFIGS: Record<ToolKey, { 
  title: string; 
  description: string; 
  cost: number;
  promptLabel: string;
  placeholder: string;
  options?: { key: string; label: string; type: "select" | "input" | "number" | "switch"; options?: string[]; default: any }[];
}> = {
  chat: { 
    title: "Kubo Chat", 
    description: "Conversas, resumos, traduções e geração de textos avançada.", 
    cost: 1,
    promptLabel: "O que você deseja criar ou perguntar?",
    placeholder: "Escreva um artigo sobre economia criativa...",
  },
  nano_banana: { 
    title: "Nano Banana", 
    description: "Criar e editar imagens impressionantes com IA.", 
    cost: 1,
    promptLabel: "Descreva a imagem",
    placeholder: "Um astronauta andando a cavalo em Marte, estilo futurista...",
    options: [
      { key: "size", label: "Tamanho", type: "select", options: ["1024x1024", "1024x1792", "1792x1024"], default: "1024x1024" }
    ]
  },
  downloader: { 
    title: "Downloader Universal", 
    description: "Baixe vídeos de qualquer rede social (YouTube, TikTok, Instagram).", 
    cost: 2,
    promptLabel: "URL do vídeo",
    placeholder: "https://www.youtube.com/watch?v=...",
    options: [
      { key: "format", label: "Formato", type: "select", options: ["mp4", "mp3"], default: "mp4" }
    ]
  },
  clips: { 
    title: "Kubo Clips", 
    description: "Crie cortes virais automáticos de vídeos longos.", 
    cost: 1,
    promptLabel: "URL do vídeo ou Transcrição",
    placeholder: "Cole a URL do vídeo ou o texto para ser transformado em clips...",
  },
  avatar: { 
    title: "Kubo Avatar AI", 
    description: "Avatares falantes com narração IA ultra-realista.", 
    cost: 2,
    promptLabel: "Texto para o avatar falar",
    placeholder: "Olá, bem-vindo ao futuro da criação de conteúdo...",
    options: [
      { key: "voice", label: "Voz", type: "select", options: ["Male", "Female", "Neutral"], default: "Male" }
    ]
  },
  shorts: { 
    title: "Kubo Shorts", 
    description: "Vídeos curtos verticais gerados a partir de texto.", 
    cost: 3,
    promptLabel: "Roteiro ou tema",
    placeholder: "Crie um vídeo de 30 segundos sobre curiosidades do café...",
  },
  music: { 
    title: "Kubo Music AI", 
    description: "Gere músicas originais completas via Suno IA.", 
    cost: 1,
    promptLabel: "Estilo e tema da música",
    placeholder: "Um lo-fi relaxante para estudar com batidas de jazz...",
    options: [
      { key: "instrumental", label: "Instrumental", type: "switch", default: false }
    ]
  },
  ebook: { 
    title: "Kubo Ebook AI", 
    description: "eBooks completos com capa, capítulos e conteúdo.", 
    cost: 10,
    promptLabel: "Tema do Ebook",
    placeholder: "Guia definitivo para Marketing Digital em 2024...",
    options: [
      { key: "chapters", label: "Número de capítulos", type: "number", default: 5 }
    ]
  },
  emo: { 
    title: "Kubo EMO AI", 
    description: "Animação realista de fotos a partir de um vídeo de referência.", 
    cost: 5,
    promptLabel: "Instruções adicionais",
    placeholder: "Mantenha a expressão natural do rosto...",
  }
};

export function CreativeToolInterface({ toolKey, onSuccess }: Props) {
  const config = TOOL_CONFIGS[toolKey];
  const [prompt, setPrompt] = useState("");
  const [metadata, setMetadata] = useState<Record<string, any>>(
    config.options?.reduce((acc, opt) => ({ ...acc, [opt.key]: opt.default }), {}) || {}
  );
  const [loading, setLoading] = useState(false);
  const [traceInfo, setTraceInfo] = useState<{ correlationId?: string; traceId?: string } | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; correlationId?: string; traceId?: string } | null>(null);
  const { subscription, editsRemaining } = useSubscription();

  const handleExecute = async () => {
    if (loading) return; // Prevent double clicks
    
    if (!prompt.trim() && toolKey !== "emo") {
      toast.error("O campo de prompt/URL é obrigatório");
      return;
    }

    const cost = config.cost;
    const balance = editsRemaining || 0;

    if (balance < cost) {
      toast.error("Saldo insuficiente", {
        description: `Esta ferramenta custa ${cost} créditos, mas você possui apenas ${balance}.`
      });
      return;
    }

    setLoading(true);
    setTraceInfo(null);
    setErrorState(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const TOOL_TO_FN: Record<string, string> = {
        chat: "creative-chat",
        nano_banana: "creative-image",
        downloader: "creative-download",
        clips: "creative-clips",
        avatar: "creative-video",
        shorts: "creative-video",
        music: "creative-music",
        ebook: "creative-ebook",
        emo: "emo-animate"
      };

      const fnName = TOOL_TO_FN[toolKey];
      
      const body: any = { prompt, metadata };
      if (toolKey === "chat") body.messages = [{ role: "user", content: prompt }];
      if (toolKey === "avatar") body.mode = "avatar";
      if (toolKey === "shorts") body.mode = "shorts";
      if (toolKey === "ebook") body.topic = prompt;
      
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({ error: "Resposta inválida do servidor" }));
      
      const cId = r.headers.get("x-correlation-id");
      const tId = r.headers.get("x-trace-id");
      if (cId || tId) setTraceInfo({ correlationId: cId || undefined, traceId: tId || undefined });

      if (!r.ok) {
        console.error("[CreativePanel:Configuration] execution_failed", { 
          toolKey, 
          error: data.error, 
          correlationId: cId, 
          traceId: tId 
        });
        throw new Error(data.error || "Erro na execução");
      }

      toast.success("Solicitação enviada!", {
        description: "Você pode acompanhar o progresso no histórico.",
      });
      setPrompt("");
      onSuccess?.();
    } catch (e: any) {
      console.error("[CreativePanel:Configuration] execution_exception", { toolKey, error: e.message, stack: e.stack });
      setErrorState({
        message: e.message,
        correlationId: traceInfo?.correlationId,
        traceId: traceInfo?.traceId
      });
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">{config.title}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-3">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Saldo: {editsRemaining ?? 0}</span>
            </Badge>
            <Badge variant="secondary" className="font-mono flex items-center gap-1.5 py-1 px-3 bg-primary/10 text-primary border-primary/20">
              <Coins className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">{config.cost} créditos</span>
            </Badge>
          </div>
        </h2>
        <p className="text-muted-foreground">{config.description}</p>
      </div>

      {(editsRemaining !== undefined && editsRemaining < config.cost) && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 animate-in fade-in zoom-in duration-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Créditos Insuficientes</AlertTitle>
          <AlertDescription>
            Você precisa de {config.cost} créditos, mas possui apenas {editsRemaining}.
          </AlertDescription>
        </Alert>
      )}

      {errorState && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-bold">Erro na Configuração</AlertTitle>
          <AlertDescription>
            <p>{errorState.message}</p>
            {(errorState.correlationId || errorState.traceId) && (
              <div className="mt-2 text-[10px] font-mono opacity-70">
                {errorState.correlationId && <p>CorrelationID: {errorState.correlationId}</p>}
                {errorState.traceId && <p>TraceID: {errorState.traceId}</p>}
              </div>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-3 bg-background/50 hover:bg-background border-destructive/20 text-destructive"
              onClick={handleExecute}
            >
              <RotateCw className="h-3.5 w-3.5 mr-2" /> Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {traceInfo && !errorState && (
        <Alert variant="default" className="bg-muted/50 border-muted-foreground/20 text-xs py-2">
          <div className="flex flex-col gap-0.5 opacity-70">
            {traceInfo.correlationId && <span>ID de Correlação: {traceInfo.correlationId}</span>}
            {traceInfo.traceId && <span>ID de Rastreio: {traceInfo.traceId}</span>}
          </div>
        </Alert>
      )}

      <Card className="p-6 bg-card/40 backdrop-blur border-border/40 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{config.promptLabel}</Label>
          <Textarea 
            placeholder={config.placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] bg-background/50 border-border/40 focus:ring-primary/20"
          />
        </div>

        {config.options && config.options.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
              <Settings2 className="h-4 w-4" /> Configurações Avançadas
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.options.map((opt) => (
                <div key={opt.key} className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{opt.label}</Label>
                  {opt.type === "select" ? (
                    <select 
                      className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={metadata[opt.key]}
                      onChange={(e) => setMetadata({ ...metadata, [opt.key]: e.target.value })}
                    >
                      {opt.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : opt.type === "number" ? (
                    <Input 
                      type="number" 
                      value={metadata[opt.key]}
                      onChange={(e) => setMetadata({ ...metadata, [opt.key]: parseInt(e.target.value) })}
                      className="bg-background/50 h-9"
                    />
                  ) : (
                    <Input 
                      value={metadata[opt.key]}
                      onChange={(e) => setMetadata({ ...metadata, [opt.key]: e.target.value })}
                      className="bg-background/50 h-9"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 flex items-center justify-between gap-4 border-t border-border/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>Sua execução entrará na fila de processamento.</span>
          </div>
          <Button 
            onClick={handleExecute} 
            disabled={loading}
            className="px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Gerar Agora
          </Button>
        </div>
      </Card>
    </div>
  );
}
