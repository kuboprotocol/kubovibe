import { useState, useEffect, useCallback } from "react";
import heic2any from "heic2any";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Send, Coins, Settings2, Info, AlertCircle, Wallet, RotateCw, Upload, X, Image as ImageIcon } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  const [errorState, setErrorState] = useState<{ message: string; correlationId?: string; traceId?: string; stack?: string } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(() => {
    if (toolKey === "avatar") {
      return localStorage.getItem("creative_last_avatar_image");
    }
    return null;
  });

  const fetchLastResult = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("creative_assets")
      .select("*")
      .eq("user_id", user.id)
      .eq("tool", toolKey)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (data) setLastResult(data);
  }, [toolKey]);

  useEffect(() => {
    fetchLastResult();
  }, [fetchLastResult]);

  useEffect(() => {
    if (toolKey === "avatar" && uploadedImageUrl) {
      localStorage.setItem("creative_last_avatar_image", uploadedImageUrl);
    }
  }, [uploadedImageUrl, toolKey]);

  const logAuditAction = useCallback(async (step: string, action: string, params: any = {}, correlationId?: string, traceId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await supabase.from("creative_audit_trail").insert({
        user_id: user.id,
        step,
        action,
        params,
        correlation_id: correlationId,
        trace_id: traceId
      });
    } catch (e) {
      console.error("Failed to log audit trail:", e);
    }
  }, []);
  const { subscription, editsRemaining } = useSubscription();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (max 5MB)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      toast.error("Formato inválido", {
        description: "Apenas JPG, PNG ou WEBP são aceitos."
      });
      return;
    }

    if (file.size > maxSize) {
      toast.error("Arquivo muito grande", {
        description: "O tamanho máximo permitido é 5MB."
      });
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/creative/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setUploadedImageUrl(publicUrl);
      toast.success("Imagem carregada com sucesso!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Falha ao carregar imagem: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleExecute = async () => {
    if (loading) return;
    
    if (!prompt.trim() && toolKey !== "emo" && toolKey !== "avatar") {
      toast.error("O campo de prompt/URL é obrigatório");
      return;
    }

    if (toolKey === "avatar" && !uploadedImageUrl) {
      toast.error("Por favor, selecione uma imagem para o avatar.");
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
      if (simulationMode) {
        const cId = crypto.randomUUID().slice(0, 8);
        await logAuditAction("Configuration", "execution_failed_simulated", { toolKey }, cId);
        throw new Error("Falha simulada na etapa de Configuração");
      }
      await logAuditAction("Configuration", "execution_start", { toolKey });
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
      if (toolKey === "avatar") {
        body.mode = "avatar";
        body.metadata = { ...metadata, source_image: uploadedImageUrl };
      }
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
        traceId: traceInfo?.traceId,
        stack: e.stack
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
            <div className="mt-4 flex gap-3">
              <Button 
                size="sm" 
                variant="outline" 
                className="bg-background/50 hover:bg-background border-destructive/20 text-destructive"
                onClick={handleExecute}
              >
                <RotateCw className="h-3.5 w-3.5 mr-2" /> Tentar Novamente
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="hover:bg-destructive/5 text-destructive"
                onClick={() => setShowErrorModal(true)}
              >
                Ver Detalhes
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="max-w-2xl bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> Detalhes do Erro Técnicos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground uppercase text-[10px] font-bold">Ferramenta</p>
                <p className="font-semibold">{config.title}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground uppercase text-[10px] font-bold">Correlation ID</p>
                <p className="font-mono text-xs">{errorState?.correlationId || "N/A"}</p>
              </div>
            </div>
            {errorState?.stack && (
              <div className="space-y-1 mt-4">
                <p className="text-muted-foreground uppercase text-[10px] font-bold">Stack Trace</p>
                <pre className="p-3 bg-muted/50 rounded-lg text-[10px] font-mono overflow-auto max-h-[200px] border border-border/20">
                  {errorState.stack}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

        {toolKey === "avatar" && (
          <div className="space-y-3 pb-2 border-b border-border/20">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Imagem do Avatar (Obrigatório)
            </Label>
            
            {uploadedImageUrl ? (
              <div className="flex flex-col gap-3">
                <div className="relative w-32 h-32 group">
                  <img 
                    src={uploadedImageUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover rounded-lg border-2 border-primary/20 shadow-sm" 
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="h-8 w-8 rounded-full"
                      onClick={() => setUploadedImageUrl(null)}
                      title="Remover"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs" 
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1.5" /> Trocar Imagem
                  </Button>
                  <input type="file" id="avatar-upload" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} disabled={isUploading} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-2">
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">Upload</span>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} disabled={isUploading} />
                </label>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Requisitos da Imagem:</p>
                  <ul className="text-[10px] text-muted-foreground/80 list-disc list-inside space-y-0.5">
                    <li>Formatos: JPG, PNG ou WEBP</li>
                    <li>Tamanho máximo: 5MB</li>
                    <li>Rosto claro e centralizado</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

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
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>Sua execução entrará na fila de processamento.</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="sim-mode" 
                checked={simulationMode} 
                onChange={(e) => setSimulationMode(e.target.checked)}
                className="h-3 w-3"
              />
              <label htmlFor="sim-mode" className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">Simular Falha</label>
            </div>
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
