import { useState, useEffect, useCallback } from "react";
import heic2any from "heic2any";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Send, Coins, Settings2, Info, AlertCircle, Wallet, RotateCw, Upload, X, Image as ImageIcon, Download, Crop as CropIcon, Trash2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AvatarCropDialog } from "./AvatarCropDialog";
import { AvatarProgressSteps, type AvatarStepState, type AvatarStepKey } from "./AvatarProgressSteps";

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
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<AvatarStepState[]>([]);
  const [avatarPreset, setAvatarPreset] = useState<{ zoom: number; aspect: number }>(() => {
    const saved = localStorage.getItem("creative_avatar_preset");
    return saved ? JSON.parse(saved) : { zoom: 1, aspect: 1 };
  });

  const buildSteps = (needsConvert: boolean): AvatarStepState[] => {
    const now = new Date().toLocaleTimeString();
    return [
      { key: "upload", label: "Upload da imagem", status: "pending", timestamp: now },
      { key: "convert", label: "Conversão HEIC/SVG", status: needsConvert ? "pending" : "skipped", timestamp: needsConvert ? now : undefined },
      { key: "generate", label: "Geração do avatar falante", status: "pending" },
      { key: "render", label: "Renderização final", status: "pending" },
    ];
  };

  const updateStep = (key: AvatarStepKey, status: AvatarStepState["status"], errorMessage?: string) => {
    setProgressSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, errorMessage, timestamp: new Date().toLocaleTimeString() } : s)));
  };

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

  const uploadBlobToStorage = async (blob: Blob, extension: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    const filePath = `${user.id}/creative/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    // Reset input so selecting the same file again triggers change
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    const needsConvert =
      file.type === "image/heic" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.type === "image/svg+xml";
    if (toolKey === "avatar") setProgressSteps(buildSteps(needsConvert));
    try {
      if (toolKey === "avatar") updateStep("upload", "active");

      // Convert HEIC → JPG
      if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        try {
            if (toolKey === "avatar") updateStep("convert", "active");
            toast.info("Convertendo formato HEIC...");
            const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
            file = new File(
            [Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob],
            file.name.replace(/\.[^/.]+$/, ".jpg"),
            { type: "image/jpeg" }
            );
            if (toolKey === "avatar") updateStep("convert", "done");
        } catch (err: any) {
            if (toolKey === "avatar") updateStep("convert", "error", "Falha na conversão HEIC. O arquivo pode estar corrompido.");
            throw new Error("Não foi possível processar o arquivo HEIC.");
        }
      } else if (file.type === "image/svg+xml") {
        try {
            // Convert SVG → PNG via canvas
            if (toolKey === "avatar") updateStep("convert", "active");
            toast.info("Convertendo SVG para PNG...");
            const svgText = await file.text();
            const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = blobUrl;
            });
            const size = Math.max(img.width || 512, img.height || 512, 512);
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, size, size);
            URL.revokeObjectURL(blobUrl);
            const pngBlob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png", 0.95));
            file = new File([pngBlob], file.name.replace(/\.[^/.]+$/, ".png"), { type: "image/png" });
            if (toolKey === "avatar") updateStep("convert", "done");
        } catch (err: any) {
            if (toolKey === "avatar") updateStep("convert", "error", "Falha na conversão SVG. Verifique se o arquivo é um SVG válido.");
            throw new Error("Não foi possível processar o arquivo SVG.");
        }
      }

      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 10 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        const errorMsg = "Formato aceito: JPG, PNG, WEBP, SVG ou HEIC.";
        if (toolKey === "avatar") updateStep("upload", "error", errorMsg);
        toast.error("Formato inválido", { description: errorMsg });
        setIsUploading(false);
        return;
      }
      if (file.size > maxSize) {
        const errorMsg = "O tamanho máximo permitido é 10MB.";
        if (toolKey === "avatar") updateStep("upload", "error", errorMsg);
        toast.error("Arquivo muito grande", { description: errorMsg });
        setIsUploading(false);
        return;
      }

      // For avatar, open crop dialog using a local object URL (don't upload yet)
      if (toolKey === "avatar") {
        const localUrl = URL.createObjectURL(file);
        setCropSourceUrl(localUrl);
        setCropOpen(true);
        setIsUploading(false);
        return;
      }

      const fileExt = file.name.split('.').pop() || "png";
      const publicUrl = await uploadBlobToStorage(file, fileExt);
      setUploadedImageUrl(publicUrl);
      toast.success("Imagem carregada com sucesso!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Falha ao carregar imagem: " + error.message);
      if (toolKey === "avatar" && progressSteps.find(s => s.key === "convert")?.status === "active") {
          // Handled above, but ensuring fallback
      } else if (toolKey === "avatar") {
          updateStep("upload", "error", error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropConfirm = async (blob: Blob, preset: { zoom: number; aspect: number }) => {
    try {
      const publicUrl = await uploadBlobToStorage(blob, "png");
      setUploadedImageUrl(publicUrl);
      setAvatarPreset(preset);
      localStorage.setItem("creative_avatar_preset", JSON.stringify(preset));
      updateStep("upload", "done");
      setCropOpen(false);
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
      setCropSourceUrl(null);
      toast.success("Avatar ajustado e salvo!");
    } catch (error: any) {
      updateStep("upload", "error", error.message);
      toast.error("Falha ao salvar recorte: " + error.message);
    }
  };

  const handleResetSessionAvatar = () => {
    localStorage.removeItem("creative_last_avatar_image");
    setUploadedImageUrl(null);
    setProgressSteps([]);
    toast.success("Avatar padrão da sessão removido.");
  };

  const handleDownloadResult = async (format: "png" | "jpg" = "png") => {
    if (!lastResult?.asset_url) return;
    try {
      const res = await fetch(lastResult.asset_url);
      const blob = await res.blob();
      const isVideo = lastResult.asset_url.endsWith(".mp4");
      
      let finalBlob = blob;
      let ext = isVideo ? "mp4" : format;

      if (!isVideo && format === "jpg") {
        // Convert PNG/WebP blob to JPG via canvas if needed
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(blob);
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white"; // JPG doesn't support transparency
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        finalBlob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.90)) as Blob;
        URL.revokeObjectURL(img.src);
      }

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kubo-avatar-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Falha ao baixar: " + e.message);
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
    if (toolKey === "avatar") {
      // Ensure steps reflect generation phase (upload is already done)
      setProgressSteps((prev) => {
        const base = prev.length ? prev : buildSteps(false);
        return base.map((s) => {
          if (s.key === "upload") return { ...s, status: "done" };
          if (s.key === "generate") return { ...s, status: "active" };
          return s;
        });
      });
    }
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

      if (toolKey === "avatar") {
        updateStep("generate", "done");
        updateStep("render", "active");
      }
      toast.success("Solicitação enviada!", {
        description: "Você pode acompanhar o progresso no histórico.",
      });
      setPrompt("");
      onSuccess?.();
      if (toolKey === "avatar") {
        // Re-fetch result and finalize render step shortly after
        setTimeout(async () => {
          await fetchLastResult();
          updateStep("render", "done");
        }, 1500);
      }
    } catch (e: any) {
      console.error("[CreativePanel:Configuration] execution_exception", { toolKey, error: e.message, stack: e.stack });
      setErrorState({
        message: e.message,
        correlationId: traceInfo?.correlationId,
        traceId: traceInfo?.traceId,
        stack: e.stack
      });
      if (toolKey === "avatar") {
        setProgressSteps((prev) =>
          prev.map((s) =>
            s.status === "active" ? { ...s, status: "pending" } : s
          )
        );
      }
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1.5" /> Trocar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => { setCropSourceUrl(uploadedImageUrl); setCropOpen(true); }}
                  >
                    <CropIcon className="h-3 w-3 mr-1.5" /> Ajustar / Zoom
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={handleResetSessionAvatar}
                    title="Limpa o localStorage e remove o avatar padrão da sessão"
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" /> Redefinir padrão
                  </Button>
                  <input type="file" id="avatar-upload" className="hidden" accept="image/jpeg,image/png,image/webp,image/svg+xml,image/heic,.heic" onChange={handleFileUpload} disabled={isUploading} />
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
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/svg+xml,image/heic,.heic" onChange={handleFileUpload} disabled={isUploading} />
                </label>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Requisitos da Imagem:</p>
                  <ul className="text-[10px] text-muted-foreground/80 list-disc list-inside space-y-0.5">
                    <li>Formatos: JPG, PNG, WEBP, SVG ou HEIC</li>
                    <li>Tamanho máximo: 10MB</li>
                    <li>Rosto claro e centralizado</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {toolKey === "avatar" && progressSteps.length > 0 && (
          <AvatarProgressSteps steps={progressSteps} />
        )}

        {/* Comparison Section (Before vs After) */}
        {toolKey === "avatar" && lastResult && (
          <div className="pt-4 border-t border-border/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <RotateCw className="h-3 w-3" /> Último Resultado: Antes vs Depois
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-[10px] text-center text-muted-foreground font-medium uppercase">Original</p>
                <div className="aspect-square bg-muted rounded-lg overflow-hidden border border-border/40">
                  {lastResult.metadata?.source_image ? (
                    <img src={lastResult.metadata.source_image} alt="Antes" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">N/A</div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-center text-primary font-medium uppercase">Avatar Gerado</p>
                <div className="aspect-square bg-black rounded-lg overflow-hidden border border-primary/20 shadow-inner">
                  {lastResult.asset_url?.endsWith('.mp4') ? (
                    <video src={lastResult.asset_url} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={lastResult.asset_url} alt="Depois" className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] h-7 opacity-60 hover:opacity-100"
                onClick={fetchLastResult}
              >
                Atualizar Comparação
              </Button>
              {lastResult.asset_url && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-7"
                    onClick={() => handleDownloadResult("png")}
                  >
                    <Download className="h-3 w-3 mr-1.5" />
                    Baixar {lastResult.asset_url.endsWith('.mp4') ? 'MP4' : 'PNG'}
                  </Button>
                  {!lastResult.asset_url.endsWith('.mp4') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-7"
                      onClick={() => handleDownloadResult("jpg")}
                    >
                      <Download className="h-3 w-3 mr-1.5" />
                      Baixar JPG
                    </Button>
                  )}
                </div>
              )}
            </div>
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

      <AvatarCropDialog
        open={cropOpen}
        imageUrl={cropSourceUrl}
        initialPreset={avatarPreset}
        onCancel={() => {
          setCropOpen(false);
          if (cropSourceUrl && cropSourceUrl.startsWith("blob:")) URL.revokeObjectURL(cropSourceUrl);
          setCropSourceUrl(null);
        }}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
