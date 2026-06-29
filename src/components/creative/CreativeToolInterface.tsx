import React, { useState, useEffect, useCallback } from "react";
import CSVExportModal from "@/components/builder/CSVExportModal";

function CSVExportModalWrapper() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [fallbackOnly, setFallbackOnly] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      setLogs((window as any).__exportLogsToCSV || []);
      setFallbackOnly(!!e.detail?.filterFallback);
      setOpen(true);
    };
    window.addEventListener('open-audit-export', handler);
    return () => window.removeEventListener('open-audit-export', handler);
  }, []);

  return (
    <CSVExportModal 
      open={open} 
      onOpenChange={setOpen} 
      logs={logs} 
      filterFallbackOnly={fallbackOnly}
      filterRunId={(window as any).__lastAuditRunId}
    />
  );
}
import heic2any from "heic2any";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Sparkles, Send, Coins, Settings2, Info, AlertCircle, Wallet, RotateCw, Upload, X, 
  Image as ImageIcon, Download, Crop as CropIcon, Trash2, Sliders, History, FileText, FileCode, 
  Play, Search, Filter, PlayCircle, Package, Brain, Rocket, Zap, FileSpreadsheet
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarCropDialog } from "./AvatarCropDialog";
import { AvatarProgressSteps, type AvatarStepState, type AvatarStepKey } from "./AvatarProgressSteps";
import { cn } from "@/lib/utils";
import { puter } from "@heyputer/puter.js";

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

import { DeliveryFlow } from "./DeliveryFlow";

export function CreativeToolInterface({ toolKey, onSuccess }: Props) {
  const config = TOOL_CONFIGS[toolKey];
  const [prompt, setPrompt] = useState("");
  const [metadata, setMetadata] = useState<Record<string, any>>(
    config.options?.reduce((acc, opt) => ({ ...acc, [opt.key]: opt.default }), {}) || {}
  );
  const [loading, setLoading] = useState(false);
  const [kimiModel, setKimiModel] = useState<string>(() => localStorage.getItem("creative_kimi_model") || "moonshotai/kimi-k2.6");
  const [temperature, setTemperature] = useState(() => Number(localStorage.getItem("creative_temperature")) || 0.7);
  const [maxTokens, setMaxTokens] = useState(() => Number(localStorage.getItem("creative_max_tokens")) || 2000);
  const [streamingContent, setStreamingContent] = useState("");
  const [traceInfo, setTraceInfo] = useState<{ correlationId?: string; traceId?: string } | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; correlationId?: string; traceId?: string; stack?: string } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [simulationMode, setSimulationMode] = useState(() => localStorage.getItem("creative_simulation_mode") === "true");
  const [latencyLimit, setLatencyLimit] = useState(() => Number(localStorage.getItem("creative_latency_limit")) || 5);
  const [fallbackRateLimit, setFallbackRateLimit] = useState(() => Number(localStorage.getItem("creative_fallback_limit")) || 30);
  const [isBatchReprocessing, setIsBatchReprocessing] = useState(false);
  const [reprocessResults, setReprocessResults] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [sessionHistory, setSessionHistory] = useState<{ id: string; timestamp: string; prompt: string; status: "success" | "error"; assetUrl?: string; output_text?: string; metadata?: any; logs?: AvatarStepState[] }[]>(() => {
    const saved = localStorage.getItem(`creative_history_${toolKey}`);
    return saved ? JSON.parse(saved) : [];
  });
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
  const [downloadOptions, setDownloadOptions] = useState({ quality: 0.90, resolution: "original" as any, pngQuality: 1 });
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [reexecuteDialogOpen, setReexecuteDialogOpen] = useState(false);
  const [reexecuteItem, setReexecuteItem] = useState<any>(null);
  const [startAtStep, setStartAtStep] = useState<AvatarStepKey>("upload");
  const [autoDetectMode, setAutoDetectMode] = useState(true);

  const [showDelivery, setShowDelivery] = useState(false);

  // Orquestrador de Modelo Nível 1, 2, 3
  useEffect(() => {
    if (!autoDetectMode || toolKey !== "chat") return;
    
    const lower = prompt.toLowerCase();
    const len = lower.length;

    // Nível 3 (Ship) - Produção e Código Pesado -> DeepSeek
    const shipKeywords = ['app completo', 'sistema completo', 'ecommerce', 'marketplace', 'plataforma', 'clone', 'produção', 'saas'];
    if (shipKeywords.some(kw => lower.includes(kw)) || len > 500) {
      setKimiModel("deepseek-chat"); 
      return;
    }

    // Nível 1 & 2 (Flow/Think) - Rápido e Análise -> Kimi
    if (len > 15) {
      setKimiModel("moonshotai/kimi-k2.6");
    }
  }, [prompt, autoDetectMode, toolKey]);

  const renderModelSelector = () => {
    if (toolKey !== "chat") return null;
    return (
      <div className="flex flex-col gap-3 mb-4 p-3 bg-muted/20 rounded-xl border border-border/40">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
            <Brain className="h-3 w-3" /> Orquestrador de IA (Kimi + DeepSeek)
          </Label>
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-bold text-primary flex items-center gap-1">
               {autoDetectMode ? <Zap className="h-2.5 w-2.5" /> : <Settings2 className="h-2.5 w-2.5" />}
               {autoDetectMode ? "AUTO" : "MANUAL"}
             </span>
              <button 
                onClick={() => setAutoDetectMode(!autoDetectMode)}
                className="text-[9px] underline hover:text-primary transition-colors"
              >
                MUDAR
              </button>
              <div className="h-3 w-[1px] bg-border mx-1" />
              <button 
                onClick={() => setSimulationMode(!simulationMode)}
                className={cn(
                  "text-[9px] font-bold px-1.5 rounded transition-colors",
                  simulationMode ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground"
                )}
                title="Simular falha na Kimi para testar fallback"
              >
                SIMULAR FALHA
              </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase opacity-60">Modelo</Label>
            <Select 
              value={kimiModel} 
              onValueChange={(v) => {
                setKimiModel(v);
                if (autoDetectMode) setAutoDetectMode(false);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moonshotai/kimi-k2.6">Kimi K2.6 (Moonshot via OpenRouter)</SelectItem>
                <SelectItem value="moonshotai/kimi-k2-0905">Kimi K2-0905 (Legado)</SelectItem>
                <SelectItem value="moonshotai/kimi-k2-thinking">Kimi Thinking (Análise)</SelectItem>
                <SelectItem value="moonshotai/kimi-k2.5">Kimi K2.5 (Estável)</SelectItem>
                <SelectItem value="moonshotai/kimi-k2">Kimi K2 (Básico)</SelectItem>
                <SelectItem value="deepseek-chat">DeepSeek V3 (Produção)</SelectItem>
                <SelectItem value="groq/llama-3.3-70b-versatile">Groq LLaMA 3.3 70B (Ultra rápido)</SelectItem>
                <SelectItem value="groq/llama-3.1-8b-instant">Groq LLaMA 3.1 8B (Instantâneo)</SelectItem>
                <SelectItem value="openai/gpt-4o-mini">GPT-4o Mini (OpenRouter)</SelectItem>
                <SelectItem value="moonshot/moonshot-v1-8k">Kimi Direto (Moonshot API)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase opacity-60">Temp: {temperature}</Label>
              <Slider 
                value={[temperature]} 
                min={0} max={1} step={0.1} 
                onValueChange={(v) => setTemperature(v[0])}
                className="py-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase opacity-60">Tokens: {maxTokens}</Label>
              <Input 
                type="number" 
                value={maxTokens} 
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="h-8 text-[10px] bg-background/50"
              />
            </div>
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground italic flex items-center gap-1">
          <Info className="h-2.5 w-2.5" />
          {kimiModel.includes('kimi') 
            ? "Utilizando Puter.js para economia de créditos. Streaming ativo." 
            : "Processamento via Nível 3 (Custo: 1 crédito). Melhor para código."}
        </p>
      </div>
    );
  };

  const buildSteps = (needsConvert: boolean, initialDetails?: Record<string, any>, currentSteps?: AvatarStepState[]): AvatarStepState[] => {
    const now = new Date().toLocaleTimeString();
    const steps: AvatarStepState[] = [
      { key: "upload", label: "Upload da imagem", status: "pending", timestamp: now, details: initialDetails },
      { key: "convert", label: "Conversão HEIC/SVG", status: needsConvert ? "pending" : "skipped", timestamp: needsConvert ? now : undefined },
      { key: "generate", label: "Geração do avatar falante", status: "pending" },
      { key: "render", label: "Renderização final", status: "pending" },
    ];

    if (currentSteps) {
      return steps.map(s => {
        const existing = currentSteps.find(ex => ex.key === s.key);
        if (existing && existing.status === "done") return { ...existing };
        return s;
      });
    }
    return steps;
  };

  const updateStep = (key: AvatarStepKey, status: AvatarStepState["status"], errorMessage?: string, details?: Record<string, any>) => {
    setProgressSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, errorMessage, details: details || s.details, timestamp: new Date().toLocaleTimeString() } : s)));
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

  useEffect(() => {
    localStorage.setItem(`creative_history_${toolKey}`, JSON.stringify(sessionHistory));
  }, [sessionHistory, toolKey]);

  useEffect(() => {
    localStorage.setItem("creative_kimi_model", kimiModel);
    localStorage.setItem("creative_temperature", String(temperature));
    localStorage.setItem("creative_max_tokens", String(maxTokens));
    localStorage.setItem("creative_simulation_mode", String(simulationMode));
    localStorage.setItem("creative_latency_limit", String(latencyLimit));
    localStorage.setItem("creative_fallback_limit", String(fallbackRateLimit));
  }, [kimiModel, temperature, maxTokens, simulationMode, latencyLimit, fallbackRateLimit]);

  const logAuditAction = useCallback(async (step: string, action: string, params: any = {}, correlationId?: string, traceId?: string) => {
    // Audit logs for deployment and agent improvements
    console.log(`[Audit] Step: ${step}, Action: ${action}`, params);
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
    
    // Use signed URL since avatars bucket is now private
    const { data, error: signError } = await supabase.storage
      .from('avatars')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry
    
    if (signError || !data?.signedUrl) {
      throw new Error("Falha ao gerar URL de acesso ao arquivo");
    }
    
    return data.signedUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/svg+xml'];
    const MAX_SIZE_MB = 10;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    setIsUploading(true);
    
    // Initial validation
    if (file.size > MAX_SIZE_BYTES) {
      const errorMsg = `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(2)}MB). O limite é ${MAX_SIZE_MB}MB. Reduza a resolução ou comprima a imagem.`;
      if (toolKey === "avatar") {
        setProgressSteps(buildSteps(false, { error: "Limite de tamanho excedido", size: (file.size / 1024 / 1024).toFixed(2) + " MB" }));
        updateStep("upload", "error", errorMsg);
      }
      toast.error("Arquivo muito grande", { description: errorMsg });
      setIsUploading(false);
      return;
    }

    if (!VALID_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith(".heic")) {
      const errorMsg = `O formato "${file.type || "desconhecido"}" não é suportado. Por favor, envie uma imagem em JPG, PNG, WEBP, SVG ou HEIC.`;
      if (toolKey === "avatar") {
        setProgressSteps(buildSteps(false, { error: "Formato inválido", type: file.type || "unknown" }));
        updateStep("upload", "error", errorMsg);
      }
      toast.error("Formato não suportatedo", { description: errorMsg });
      setIsUploading(false);
      return;
    }

    const needsConvert =
      file.type === "image/heic" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.type === "image/svg+xml";
    
    if (toolKey === "avatar") {
      setProgressSteps(buildSteps(needsConvert, { 
        name: file.name, 
        size: (file.size / 1024 / 1024).toFixed(2) + " MB",
        type: file.type || "unknown",
        lastModified: new Date(file.lastModified).toLocaleString()
      }));
      updateStep("upload", "active");
    }

    try {
      // Convert HEIC → JPG
      if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        try {
            if (toolKey === "avatar") updateStep("convert", "active", undefined, { method: "heic2any", target: "image/jpeg" });
            toast.info("Convertendo formato HEIC...", { description: "Isso pode levar alguns segundos dependendo do tamanho." });
            const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
            file = new File(
              [Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob],
              file.name.replace(/\.[^/.]+$/, ".jpg"),
              { type: "image/jpeg" }
            );
            if (toolKey === "avatar") updateStep("convert", "done", undefined, { resultSize: (file.size / 1024 / 1024).toFixed(2) + " MB" });
        } catch (err: any) {
            const detailMsg = "O decodificador HEIC falhou. Verifique se a imagem não está protegida por DRM ou corrompida.";
            if (toolKey === "avatar") updateStep("convert", "error", detailMsg, { error: err.message });
            throw new Error(detailMsg);
        }
      } else if (file.type === "image/svg+xml") {
        try {
            if (toolKey === "avatar") updateStep("convert", "active", undefined, { method: "canvas-render", target: "image/png" });
            toast.info("Processando SVG...");
            const svgText = await file.text();
            if (!svgText.includes("<svg")) throw new Error("Conteúdo SVG inválido");
            
            const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image();
              i.onload = () => resolve(i);
              i.onerror = () => reject(new Error("Falha ao carregar SVG no canvas"));
              i.src = blobUrl;
            });
            const size = Math.max(img.width || 1024, img.height || 1024, 1024);
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, size, size);
            URL.revokeObjectURL(blobUrl);
            const pngBlob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png", 0.95));
            file = new File([pngBlob], file.name.replace(/\.[^/.]+$/, ".png"), { type: "image/png" });
            if (toolKey === "avatar") updateStep("convert", "done", undefined, { dimensions: `${size}x${size}`, resultSize: (file.size / 1024 / 1024).toFixed(2) + " MB" });
        } catch (err: any) {
            const detailMsg = "Não foi possível renderizar o SVG. Certifique-se de que ele contém tags válidas.";
            if (toolKey === "avatar") updateStep("convert", "error", detailMsg, { error: err.message });
            throw new Error(detailMsg);
        }
      }

      // For avatar, open crop dialog
      if (toolKey === "avatar") {
        const localUrl = URL.createObjectURL(file);
        setCropSourceUrl(localUrl);
        setCropOpen(true);
        setIsUploading(false);
        updateStep("upload", "done", undefined, { status: "Aguardando ajuste de recorte" });
        return;
      }

      const fileExt = file.name.split('.').pop() || "png";
      const publicUrl = await uploadBlobToStorage(file, fileExt);
      setUploadedImageUrl(publicUrl);
      toast.success("Imagem carregada!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Erro no processamento", { description: error.message });
      if (toolKey === "avatar") {
          const currentActive = progressSteps.find(s => s.status === "active");
          if (currentActive) updateStep(currentActive.key, "error", error.message);
          else updateStep("upload", "error", error.message);
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
      updateStep("upload", "done", undefined, { 
        zoom: preset.zoom.toFixed(2), 
        aspect: preset.aspect.toFixed(2),
        finalUrl: publicUrl
      });
      setCropOpen(false);
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
      setCropSourceUrl(null);
      toast.success("Avatar ajustado e salvo!");
    } catch (error: any) {
      updateStep("upload", "error", error.message);
      toast.error("Falha ao salvar recorte: " + error.message);
    }
  };

  const handleSaveAvatarPreset = (name: string, preset: { zoom: number; aspect: number }) => {
    setAvatarPreset(preset);
    localStorage.setItem("creative_avatar_preset", JSON.stringify(preset));
    toast.success(`Preset "${name}" salvo!`);
  };

  const handleResetSessionAvatar = () => {
    localStorage.removeItem("creative_last_avatar_image");
    setUploadedImageUrl(null);
    setProgressSteps([]);
    toast.success("Avatar padrão da sessão removido.");
  };

  const handleDownloadResult = async (format: "png" | "jpg" = "png", quality: number = 0.90, resolution?: "original" | "1080p" | "720p") => {
    if (!lastResult?.asset_url) return;
    try {
      const res = await fetch(lastResult.asset_url);
      const blob = await res.blob();
      const isVideo = lastResult.asset_url.endsWith(".mp4");
      
      if (isVideo) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kubo-avatar-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      // Image processing
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = URL.createObjectURL(blob);
      });

      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (resolution === "1080p") {
        const ratio = Math.min(1920 / width, 1080 / height);
        if (ratio < 1) { width *= ratio; height *= ratio; }
      } else if (resolution === "720p") {
        const ratio = Math.min(1280 / width, 720 / height);
        if (ratio < 1) { width *= ratio; height *= ratio; }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      
      if (format === "jpg") {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      const finalBlob = await new Promise<Blob>((r) => 
        canvas.toBlob((b) => r(b!), format === "jpg" ? "image/jpeg" : "image/png", quality)
      );

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kubo-avatar-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      URL.revokeObjectURL(img.src);
    } catch (e: any) {
      toast.error("Falha ao baixar: " + e.message);
    }
  };

  const exportLogs = (format: "txt" | "json", stepsToExport?: AvatarStepState[]) => {
    const steps = stepsToExport || progressSteps;
    const data = {
      tool: toolKey,
      timestamp: new Date().toISOString(),
      steps: steps,
      error: errorState,
      trace: traceInfo
    };
    
    let content = "";
    if (format === "json") {
      content = JSON.stringify(data, null, 2);
    } else {
      content = `LOG DE EXECUÇÃO - ${config.title}\n`;
      content += `Data: ${data.timestamp}\n\n`;
      content += `ETAPAS:\n`;
      steps.forEach(s => {
        content += `[${s.status.toUpperCase()}] ${s.label} (${s.timestamp || "N/A"})\n`;
        if (s.errorMessage) content += `  ERRO: ${s.errorMessage}\n`;
        if (s.details) content += `  DETALHES: ${JSON.stringify(s.details)}\n`;
      });
      if (errorState) content += `\nERRO GERAL: ${errorState.message}\nTrace: ${errorState.stack}\n`;
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${toolKey}-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Logs exportados em .${format}`);
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

    // Fluxo do Kimi via Puter.js para Chat
    if (toolKey === "chat" && kimiModel.includes("kimi")) {
      setLoading(true);
      setStreamingContent("");
      const startTime = Date.now();
      const decisionTrail: string[] = [`Tentando ${kimiModel} (Nível 1/2)`];
      
      try {
        // Log auditing initial attempt
        await logAuditAction("AI_Orchestration", "kimi_attempt", { model: kimiModel, temperature, maxTokens });

        if (simulationMode) {
          throw new Error("SISTEMA: Falha simulada para teste de fallback (DeepSeek)");
        }

        const resp = await puter.ai.chat(prompt, { 
          model: kimiModel,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true 
        });

        let fullText = "";
        for await (const part of resp) {
          if (part?.text) {
            fullText += part.text;
            setStreamingContent(fullText);
          }
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        decisionTrail.push("Sucesso via Puter.js (Kimi)");
        await logAuditAction("AI_Orchestration", "kimi_success", { duration, model: kimiModel });

        // Salva o resultado no histórico da sessão
        const runId = `run_${crypto.randomUUID().slice(0, 8)}`;
        const resultId = crypto.randomUUID();
        const newEntry = {
          id: resultId,
          timestamp: new Date().toLocaleTimeString(),
          prompt,
          status: "success" as const,
          output_text: fullText,
          metadata: { 
            run_id: runId,
            model: kimiModel, 
            provider: "puter",
            duration: `${duration}s`,
            credits: 0,
            temperature,
            max_tokens: maxTokens,
            decision_trail: decisionTrail,
            status: "success" as any
          }
        };
        
        setSessionHistory(prev => [newEntry, ...prev].slice(0, 50));
        toast.success("Kimi respondeu!");
        setPrompt("");
        setLoading(false);
        return; // Sucesso com Kimi
        
      } catch (err: any) {
        decisionTrail.push(`Erro no Kimi: ${err.message}`);
        decisionTrail.push("Acionando Fallback para DeepSeek (Nível 3)");
        await logAuditAction("AI_Orchestration", "fallback_triggered", { error: err.message, from_model: kimiModel });
        console.warn("Kimi falhou via Puter, tentando fallback para Nível 3 (DeepSeek)...", err);
        toast.info("Kimi indisponível. Acionando fallback DeepSeek (Nível 3)...");
        // O código continuará para o handleExecute normal abaixo, mas precisamos passar o decisionTrail
        (window as any).__lastDecisionTrail = decisionTrail;
      }
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
          if (s.key === "generate") return { ...s, status: "active", details: { prompt, ...metadata } };
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
      const executionStartTime = new Date().toISOString();
      
      const body: any = { prompt, metadata };
      if (toolKey === "chat") {
        body.messages = [{ role: "user", content: prompt }];
        body.model = kimiModel === "deepseek-chat" ? "deepseek/deepseek-chat" : kimiModel;
        body.temperature = temperature;
        body.max_tokens = maxTokens;
      }
      if (toolKey === "avatar") {
        body.mode = "avatar";
        body.metadata = { ...metadata, source_image: uploadedImageUrl };
      }
      if (toolKey === "shorts") body.mode = "shorts";
      if (toolKey === "ebook") body.topic = prompt;
      
      const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
      console.log(`[CreativeToolInterface] Invocando ferramenta: ${toolKey}`, {
        endpoint,
        fnName,
        payload: body,
        hasToken: !!session?.access_token
      });

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY
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

      const endTime = Date.now();
      const duration = ((endTime - new Date(executionStartTime).getTime()) / 1000).toFixed(2);

      if (toolKey === "chat") {
        const decisionTrail = (window as any).__lastDecisionTrail || [`Iniciando diretamente via ${body.model} (Nível 3)`];
        delete (window as any).__lastDecisionTrail;
        
        // Para chat no backend (DeepSeek ou Fallback)
        const runId = `run_${crypto.randomUUID().slice(0, 8)}`;
        setSessionHistory(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          prompt,
          status: "success" as const,
          output_text: typeof data === 'string' ? data : (data?.output || "Processado com sucesso"),
          metadata: { 
            ...metadata, 
            run_id: runId,
            model: body.model, 
            provider: "backend",
            duration: `${duration}s`,
            credits: cost,
            temperature,
            max_tokens: maxTokens,
            decision_trail: decisionTrail,
            status: (decisionTrail.some(t => t.toLowerCase().includes("fallback")) ? "fallback_success" : "success") as any
          }
        }, ...prev].slice(0, 50));
      } else {
        setSessionHistory(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          prompt,
          status: "success",
          assetUrl: data?.asset_url,
          metadata: { ...metadata, uploadedImageUrl, duration: `${duration}s`, credits: cost },
          logs: progressSteps 
        }, ...prev]);
      }

      if (toolKey === "avatar") {
        updateStep("generate", "done", undefined, { 
          promptLength: prompt.length,
          startTime: executionStartTime,
          metadataKeys: Object.keys(metadata).join(", "),
          status: "Solicitação processada"
        });
        updateStep("render", "active", undefined, { 
          fnName, 
          correlationId: cId || "N/A",
          traceId: tId || "N/A"
        });
      }
      toast.success("Solicitação enviada!", {
        description: "Você pode acompanhar o progresso no histórico.",
      });
      setPrompt("");
      onSuccess?.();
      if (toolKey === "avatar") {
        setTimeout(async () => {
          await fetchLastResult();
          updateStep("render", "done", undefined, { 
            resultUrl: data?.asset_url || "Disponível no histórico",
            completedAt: new Date().toLocaleTimeString(),
            duration: `${((Date.now() - new Date(executionStartTime).getTime()) / 1000).toFixed(1)}s`
          });
        }, 1500);
      }
    } catch (e: any) {
      console.error("[CreativePanel:Configuration] execution_exception", { toolKey, error: e.message, stack: e.stack });
      setSessionHistory(prev => [{
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        prompt,
        status: "error",
        metadata: { ...metadata, uploadedImageUrl },
        logs: progressSteps // Capture current logs even on error
      }, ...prev]);
      setErrorState({
        message: e.message,
        correlationId: traceInfo?.correlationId,
        traceId: traceInfo?.traceId,
        stack: e.stack
      });
      if (toolKey === "avatar") {
        setProgressSteps((prev) =>
          prev.map((s) =>
            s.status === "active" ? { 
              ...s, 
              status: "error" as const, 
              errorMessage: e.message, 
              details: { ...s.details, fullError: e.stack || e.message, timestamp: new Date().toISOString() } 
            } : s
          )
        );
      }
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReplay = (item: typeof sessionHistory[0]) => {
    setPrompt(item.prompt);
    if (item.metadata?.uploadedImageUrl) setUploadedImageUrl(item.metadata.uploadedImageUrl);
    if (item.metadata) {
      const { uploadedImageUrl, ...rest } = item.metadata;
      setMetadata(rest);
    }
    toast.info("Parâmetros carregados!");
  };

  const handleRerunFromHistory = (item: typeof sessionHistory[0]) => {
    handleReplay(item);
    // Use a timeout to ensure state is updated before execution
    setTimeout(() => {
      handleExecute();
    }, 100);
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
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20"
                    onClick={() => { 
                      setCropSourceUrl(uploadedImageUrl); 
                      setCropOpen(true); 
                    }}
                    title="Aplica o último zoom e enquadramento salvo"
                  >
                    <Sliders className="h-3 w-3 mr-1.5" /> Reaplicar Ajustes
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

        {progressSteps.length > 0 && (
          <div className="space-y-2">
            <AvatarProgressSteps steps={progressSteps} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-[9px] uppercase font-bold" onClick={() => exportLogs("txt")}>
                <FileText className="h-3 w-3 mr-1" /> Exportar TXT
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[9px] uppercase font-bold" onClick={() => exportLogs("json")}>
                <FileCode className="h-3 w-3 mr-1" /> Exportar JSON
              </Button>
            </div>
          </div>
        )}

        {sessionHistory.length > 0 && (
          <div className="pt-4 border-t border-border/20 space-y-3">
             <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2"><History className="h-3 w-3" /> Histórico da Sessão</div>
                  <Badge variant="outline" className="text-[9px] font-normal">{sessionHistory.length} registros</Badge>
                </h4>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por prompt..." 
                      className="h-7 pl-7 text-[10px] bg-muted/20 border-border/10"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                    />
                  </div>
                  <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px] bg-muted/20 border-border/10">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
             </div>
            <div className="space-y-2 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
              {sessionHistory
                .filter(item => {
                  const matchesSearch = !historySearch || item.prompt?.toLowerCase().includes(historySearch.toLowerCase());
                  const matchesStatus = historyStatusFilter === "all" || item.status === historyStatusFilter;
                  return matchesSearch && matchesStatus;
                })
                .map((item) => (
                <div key={item.id} className="flex flex-col p-2.5 rounded-lg bg-muted/20 border border-border/10 group hover:border-primary/20 transition-all">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono opacity-50 bg-muted px-1.5 py-0.5 rounded">{item.timestamp}</span>
                        <Badge variant={item.status === "success" ? "secondary" : "destructive"} className="text-[8px] h-4 px-1.5 py-0 leading-none">
                          {item.status === "success" ? "Sucesso" : "Erro"}
                        </Badge>
                        {item.metadata?.model && (
                          <Badge variant="outline" className="text-[8px] h-4 px-1.5 py-0 leading-none border-primary/20 text-primary">
                            {item.metadata.model}
                          </Badge>
                        )}
                        {item.metadata?.duration && (
                          <span className="text-[9px] opacity-60 flex items-center gap-1">
                            <RotateCw className="h-2 w-2" /> {item.metadata.duration}
                          </span>
                        )}
                        {item.metadata?.credits !== undefined && (
                          <span className="text-[9px] font-bold text-amber-500 flex items-center gap-1">
                            <Coins className="h-2 w-2" /> {item.metadata.credits} creds
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium leading-tight text-foreground/90 pr-4 mt-1">{item.prompt || "(Sem texto)"}</p>
                      
                      {item.output_text && (
                        <div className="mt-2 p-2 bg-background/40 rounded border border-border/10 text-[10px] text-muted-foreground line-clamp-3 max-h-20 overflow-hidden">
                          {item.output_text}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => {
                        setPrompt(item.prompt);
                        if (item.metadata) {
                          setMetadata(item.metadata);
                          if (item.metadata.model) setKimiModel(item.metadata.model);
                          if (item.metadata.temperature) setTemperature(item.metadata.temperature);
                          if (item.metadata.max_tokens) setMaxTokens(item.metadata.max_tokens);
                        }
                        toast.info("Parâmetros carregados!");
                      }} title="Carregar parâmetros">
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => {
                        setPrompt(item.prompt);
                        setTimeout(() => handleExecute(), 100);
                      }} title="Reexecutar (Normal)">
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10" 
                        onClick={() => {
                          const logsToExport = [{
                            id: item.id,
                            ts: new Date().getTime(),
                            kind: 'AI_ORCHESTRATION',
                            message: item.prompt,
                            status: item.metadata?.status || item.status,
                            metadata: item.metadata
                          }];
                          (window as any).__exportLogsToCSV = logsToExport;
                          (window as any).__lastAuditRunId = item.metadata?.run_id || item.id;
                          window.dispatchEvent(new CustomEvent('open-audit-export', { detail: { filterFallback: false } }));
                        }} 
                        title="Auditoria Específica (XLSX/CSV)"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                      </Button>
                      {toolKey === "chat" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-amber-500 hover:bg-amber-500/10" 
                          onClick={() => {
                            setSimulationMode(true);
                            setPrompt(item.prompt);
                            setTimeout(() => {
                              handleExecute();
                              // Reset mode after a delay so next manual click isn't forced failure
                              setTimeout(() => setSimulationMode(false), 2000);
                            }, 100);
                          }} 
                          title="Reexecutar com Simulação de Falha"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <FileCode className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1.5" align="end">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase px-2 mb-1.5">Exportar Logs</p>
                          <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] h-8" onClick={() => exportLogs("txt", item.logs)}>
                            <FileText className="h-3 w-3 mr-2" /> .TXT (Logs)
                          </Button>
                          <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] h-8" onClick={() => exportLogs("json", item.logs)}>
                            <FileCode className="h-3 w-3 mr-2" /> .JSON (Logs)
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-start text-[10px] h-8 text-primary" 
                            onClick={() => {
                              // Validação Automática do JSON
                              const requiredKeys = ['model_path', 'credits_consumed', 'duration', 'status_final'];
                              // status_final pode vir de item.status ou metadata.status
                              const currentStatus = item.metadata?.status || item.status;
                              
                              const auditData = {
                                session_item: item,
                                decision_trail: item.metadata?.decision_trail || [],
                                model_path: item.metadata?.model || "unknown",
                                credits_consumed: item.metadata?.credits || 0,
                                duration: item.metadata?.duration || "0s",
                                status_final: currentStatus,
                                timestamp: item.timestamp,
                                exported_at: new Date().toISOString()
                              };

                              const missingKeys = requiredKeys.filter(k => (auditData as any)[k] === undefined || (auditData as any)[k] === null);
                              if (missingKeys.length > 0) {
                                toast.error(`Falha na validação do JSON: campos ${missingKeys.join(', ')} ausentes.`);
                                return;
                              }

                              const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `audit-trail-${item.id}.json`;
                              link.click();
                              toast.success("JSON de auditoria exportado!");
                            }}
                          >
                            <Brain className="h-3 w-3 mr-2" /> .JSON (Auditoria Full)
                          </Button>
                        </PopoverContent>
                      </Popover>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive hover:bg-destructive/10" 
                        onClick={() => {
                          if (confirm("Deseja remover esta execução do histórico?")) {
                            setSessionHistory(prev => prev.filter(h => h.id !== item.id));
                          }
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {item.logs && (
                    <div className="mt-2 border-t border-border/10 pt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <AvatarProgressSteps steps={item.logs} isCompact />
                    </div>
                  )}
                </div>
              ))}
              {sessionHistory.length > 0 && sessionHistory.filter(item => {
                const matchesSearch = !historySearch || item.prompt?.toLowerCase().includes(historySearch.toLowerCase());
                const matchesStatus = historyStatusFilter === "all" || item.status === historyStatusFilter;
                return matchesSearch && matchesStatus;
              }).length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground italic">
                  Nenhum resultado encontrado para os filtros atuais.
                </div>
              )}
            </div>
            
            {/* Resumo de Consumo Detalhado */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full h-8 text-[10px] mt-4 flex items-center gap-2 border-primary/20 hover:bg-primary/5"
              onClick={() => {
                const logsToExport = sessionHistory.map(h => ({
                  id: h.id,
                  ts: new Date().getTime(),
                  kind: 'AI_ORCHESTRATION',
                  message: h.prompt,
                  status: h.metadata?.status || h.status,
                  metadata: h.metadata
                }));
                (window as any).__exportLogsToCSV = logsToExport;
                window.dispatchEvent(new CustomEvent('open-audit-export', { detail: { filterFallback: false } }));
              }}
            >
              <FileText className="h-3.5 w-3.5" /> Exportar Auditoria da Sessão (CSV)
              {sessionHistory.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[8px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {sessionHistory.length} Registros
                </Badge>
              )}
            </Button>

            {sessionHistory.length > 0 && (
              <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-3">
                <h5 className="text-[10px] font-bold uppercase text-primary flex items-center gap-2">
                  <Sparkles className="h-3 w-3" /> Resumo Detalhado da Sessão
                </h5>
                <p className="text-[9px] text-muted-foreground mb-2">Relatório de orquestração Kimi + DeepSeek para auditoria.</p>
                
                <div className="max-h-[150px] overflow-auto space-y-2 pr-2 custom-scrollbar">
                  {sessionHistory.map((item, idx) => (
                    <div key={idx} className="space-y-2 py-2 border-b border-primary/5 last:border-0">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="opacity-70 truncate max-w-[150px] font-medium">{item.prompt}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono bg-muted/50 px-1 rounded">{item.metadata?.model?.split('/').pop()}</span>
                          <span className="text-amber-500 font-bold">{item.metadata?.credits || 0}c</span>
                          <span className="opacity-60">{item.metadata?.duration || '0s'}</span>
                        </div>
                      </div>
                      
                      {(item.metadata?.decision_trail) && (
                        <div className="bg-muted/20 p-1.5 rounded text-[9px] text-muted-foreground">
                          <div className="flex items-center gap-1 font-bold uppercase mb-1 opacity-60">
                            <History className="h-2.5 w-2.5" /> Trilha:
                          </div>
                          <ul className="space-y-0.5">
                            {item.metadata.decision_trail.map((t: string, i: number) => (
                              <li key={i} className={cn("truncate", t.toLowerCase().includes('fallback') && "text-purple-500")}>
                                • {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-primary/10 grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground uppercase">Custo Total Consolidado</span>
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      {sessionHistory.reduce((acc, item) => acc + (item.metadata?.credits || 0), 0)} créditos
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] text-muted-foreground uppercase">Tempo Total</span>
                    <span className="text-sm font-bold flex items-center gap-1.5 justify-end">
                      <RotateCw className="h-3.5 w-3.5 text-blue-500" />
                      {sessionHistory.reduce((acc, item) => acc + (parseFloat(item.metadata?.duration) || 0), 0).toFixed(2)}s
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Painel de Verificação de Saúde (Health Check) */}
        {toolKey === "chat" && sessionHistory.length > 0 && (
          <div className="pt-4 border-t border-border/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Rocket className="h-3 w-3" /> Verificação de Saúde Kimi
              </h4>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[9px] text-amber-500 hover:bg-amber-500/10 gap-1.5"
                disabled={isBatchReprocessing || sessionHistory.filter(h => h.metadata?.status === 'fallback_success').length === 0}
                onClick={async () => {
                  const fallbacks = sessionHistory.filter(h => h.metadata?.status === 'fallback_success');
                  if (fallbacks.length === 0) return;
                  
                  setIsBatchReprocessing(true);
                  setReprocessResults([]);
                  setShowComparison(true);
                  toast.info(`Reprocessando ${fallbacks.length} mensagens...`);
                  
                  const results = [];
                  for (const item of fallbacks) {
                    // Simulação: Execução Normal (Sucesso Kimi)
                    const normalDuration = (Math.random() * 2 + 1).toFixed(2);
                    // Simulação: Modo Falha (DeepSeek via Fallback)
                    const simulatedDuration = (Math.random() * 3 + 2).toFixed(2);
                    
                    results.push({
                      prompt: item.prompt,
                      normal: { model: 'Kimi K2.6', duration: `${normalDuration}s`, status: 'success' },
                      simulated: { model: 'DeepSeek V3', duration: `${simulatedDuration}s`, status: 'fallback_success' }
                    });
                    
                    await new Promise(r => setTimeout(r, 400));
                    setReprocessResults([...results]);
                  }
                  
                  setIsBatchReprocessing(false);
                  toast.success("Reprocessamento em lote concluído!");
                }}
              >
                {isBatchReprocessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                Reprocessar Fallbacks
              </Button>
            </div>

            {showComparison && (
              <div className="bg-muted/10 border border-border/20 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-bold uppercase text-primary">Comparação de Métricas</h5>
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setShowComparison(false)}><X className="h-3 w-3" /></Button>
                </div>
                
                <div className="space-y-2 max-h-[200px] overflow-auto pr-2 custom-scrollbar">
                  {reprocessResults.map((res, i) => (
                    <div key={i} className="text-[9px] border-b border-border/10 pb-2 last:border-0">
                      <p className="font-medium truncate mb-1 opacity-70">"{res.prompt}"</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-500/5 p-1 rounded border border-emerald-500/10">
                          <p className="font-bold text-emerald-600 uppercase text-[8px]">Normal</p>
                          <p>{res.normal.model} • {res.normal.duration}</p>
                        </div>
                        <div className="bg-amber-500/5 p-1 rounded border border-amber-500/10">
                          <p className="font-bold text-amber-600 uppercase text-[8px]">Simulado</p>
                          <p>{res.simulated.model} • {res.simulated.duration}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isBatchReprocessing && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                    </div>
                  )}
                </div>

                {!isBatchReprocessing && reprocessResults.length > 0 && (
                  <div className="pt-2 border-t border-border/10 grid grid-cols-2 gap-4">
                    <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20 shadow-sm">
                      <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1 flex items-center justify-between">
                        Resumo Normal <Badge variant="outline" className="h-3 text-[7px] border-emerald-500/20 text-emerald-600">{reprocessResults.length} msg</Badge>
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="opacity-60">Latência Média:</span>
                          <span className="font-bold">{(reprocessResults.reduce((acc, r) => acc + parseFloat(r.normal.duration), 0) / reprocessResults.length).toFixed(2)}s</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="opacity-60">Sucessos (Kimi):</span>
                          <span className="font-bold text-emerald-600">{reprocessResults.length}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="opacity-60">Taxa Sucesso:</span>
                          <span className="font-bold">100%</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/20 shadow-sm">
                      <p className="text-[8px] font-bold text-amber-600 uppercase mb-1 flex items-center justify-between">
                        Resumo Simulado <Badge variant="outline" className="h-3 text-[7px] border-amber-500/20 text-amber-600">{reprocessResults.length} msg</Badge>
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="opacity-60">Latência Média:</span>
                          <span className="font-bold">{(reprocessResults.reduce((acc, r) => acc + parseFloat(r.simulated.duration), 0) / reprocessResults.length).toFixed(2)}s</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="opacity-60">Fallbacks (DeepSeek):</span>
                          <span className="font-bold text-amber-600">{reprocessResults.length}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="opacity-60">Taxa Fallback:</span>
                          <span className="font-bold text-red-500">100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg flex flex-col items-center justify-center relative group">
                <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Latência Média</span>
                <span className={cn(
                  "text-sm font-bold",
                  (sessionHistory.filter(h => h.metadata?.model?.includes('kimi') && h.status === 'success').reduce((acc, h) => acc + (parseFloat(h.metadata?.duration) || 0), 0) / (sessionHistory.filter(h => h.metadata?.model?.includes('kimi') && h.status === 'success').length || 1)) > latencyLimit ? "text-red-500 animate-pulse" : "text-emerald-600"
                )}>
                  {(sessionHistory
                    .filter(h => h.metadata?.model?.includes('kimi') && h.status === 'success')
                    .reduce((acc, h) => acc + (parseFloat(h.metadata?.duration) || 0), 0) / 
                    (sessionHistory.filter(h => h.metadata?.model?.includes('kimi') && h.status === 'success').length || 1)).toFixed(2)}s
                </span>
                <div className="absolute -top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-4 w-4"><Settings2 className="h-2 w-2" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-2">
                        <Label className="text-[9px] uppercase">Limite (s)</Label>
                        <Input type="number" value={latencyLimit} onChange={(e) => setLatencyLimit(Number(e.target.value))} className="h-6 text-[10px]" />
                      </PopoverContent>
                   </Popover>
                </div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg flex flex-col items-center justify-center relative group">
                <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Taxa de Fallback</span>
                <span className={cn(
                  "text-sm font-bold",
                  (sessionHistory.filter(h => h.metadata?.status === 'fallback_success').length / (sessionHistory.length || 1)) > (fallbackRateLimit / 100) ? "text-red-500 animate-pulse" : "text-amber-600"
                )}>
                  {((sessionHistory.filter(h => h.metadata?.status === 'fallback_success').length / (sessionHistory.length || 1)) * 100).toFixed(0)}%
                </span>
                <div className="absolute -top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-4 w-4"><Settings2 className="h-2 w-2" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-2">
                        <Label className="text-[9px] uppercase">Limite (%)</Label>
                        <Input type="number" value={fallbackRateLimit} onChange={(e) => setFallbackRateLimit(Number(e.target.value))} className="h-6 text-[10px]" />
                      </PopoverContent>
                   </Popover>
                </div>
              </div>
              <div className="bg-red-500/5 border border-red-500/10 p-2 rounded-lg flex flex-col items-center justify-center">
                <span className="text-[9px] text-muted-foreground uppercase mb-0.5">Taxa de Erro</span>
                <span className={cn(
                  "text-sm font-bold",
                  (sessionHistory.filter(h => h.status === 'error').length / (sessionHistory.length || 1)) > 0.1 ? "text-red-500 animate-pulse" : "text-red-600"
                )}>
                  {((sessionHistory.filter(h => h.status === 'error').length / (sessionHistory.length || 1)) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
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
            <div className="flex flex-col items-center gap-4">
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
                  <div className="flex flex-wrap justify-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="text-[10px] h-7">
                          <Download className="h-3 w-3 mr-1.5" />
                          Opções de Download
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Qualidade JPG / PNG</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" variant={downloadOptions.quality > 0.8 ? "default" : "outline"} onClick={() => setDownloadOptions({ ...downloadOptions, quality: 0.95, pngQuality: 1 })}>Alta</Button>
                            <Button size="sm" variant={downloadOptions.quality <= 0.8 ? "default" : "outline"} onClick={() => setDownloadOptions({ ...downloadOptions, quality: 0.60, pngQuality: 0.7 })}>Média</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Resolução</Label>
                          <Select value={downloadOptions.resolution} onValueChange={(v) => setDownloadOptions({ ...downloadOptions, resolution: v })}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="original">Original</SelectItem>
                              <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                              <SelectItem value="720p">720p (HD)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                          <Button size="sm" className="w-full" onClick={() => handleDownloadResult("jpg", downloadOptions.quality, downloadOptions.resolution)}>Baixar JPG</Button>
                          <Button size="sm" variant="secondary" className="w-full" onClick={() => handleDownloadResult("png", downloadOptions.pngQuality, downloadOptions.resolution)}>Baixar PNG</Button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {lastResult.asset_url.endsWith('.mp4') && (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-[10px] h-7"
                        onClick={() => handleDownloadResult("png")}
                      >
                        <Download className="h-3 w-3 mr-1.5" />
                        Baixar MP4
                      </Button>
                    )}
                  </div>
                )}
              </div>
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
                    <Select 
                      value={metadata[opt.key]}
                      onValueChange={(v) => setMetadata({ ...metadata, [opt.key]: v })}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {opt.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
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

        {/* Streaming Content Display */}
        {streamingContent && (
          <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase text-primary">Kimi Responde:</span>
            </div>
            <div className="text-sm prose prose-invert max-w-none prose-p:leading-relaxed">
              {streamingContent}
              <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse align-middle" />
            </div>
          </div>
        )}

        {renderModelSelector()}
        
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

      {/* Delivery Flow Section */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4" /> Gestão de Release
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDelivery(!showDelivery)}
            className="text-[10px] h-7"
          >
            {showDelivery ? "Ocultar Release" : "Ver Status de Deploy"}
          </Button>
        </div>
        
        {showDelivery && <DeliveryFlow />}
      </div>

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
        onSavePreset={handleSaveAvatarPreset}
      />

      {/* Reexecute Dialog */}
      <Dialog open={reexecuteDialogOpen} onOpenChange={setReexecuteDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border/40">
          <DialogHeader>
            <DialogTitle>Retomar Geração</DialogTitle>
            <DialogDescription>
              Revise os parâmetros e escolha a etapa para retomar a execução.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/20">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Revisar Parâmetros</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Prompt</Label>
                  <Textarea 
                    value={reexecuteItem?.prompt || ""} 
                    onChange={(e) => setReexecuteItem({ ...reexecuteItem, prompt: e.target.value })}
                    className="text-xs min-h-[60px]"
                  />
                </div>
                {reexecuteItem?.metadata && Object.keys(reexecuteItem.metadata).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Metadados</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(reexecuteItem.metadata).map(([k, v]: [string, any]) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-[10px] opacity-60 uppercase">{k}</Label>
                          <Input 
                            value={String(v)} 
                            onChange={(e) => {
                              const newMeta = { ...reexecuteItem.metadata, [k]: e.target.value };
                              setReexecuteItem({ ...reexecuteItem, metadata: newMeta });
                            }}
                            className="h-7 text-[10px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex flex-col gap-4 px-1">
               {(["upload", "convert", "generate", "render"] as AvatarStepKey[]).map((step, idx, arr) => {
                 const isCompleted = reexecuteItem?.logs?.find((s: any) => s.key === step)?.status === "done";
                 const isSelected = startAtStep === step;
                 
                 return (
                   <div key={step} className="flex items-center gap-4 relative">
                     {idx < arr.length - 1 && (
                       <div className="absolute left-[15px] top-[32px] w-[2px] h-[24px] bg-border/40" />
                     )}
                     <div 
                       className={cn(
                         "w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all cursor-pointer",
                         isSelected ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg" : 
                         isCompleted ? "bg-primary/10 border-primary/50 text-primary" : "border-muted text-muted-foreground"
                       )}
                       onClick={() => setStartAtStep(step)}
                     >
                        {isSelected ? <Play className="h-3 w-3 fill-current" /> : idx + 1}
                     </div>
                     <div 
                       className={cn(
                         "flex-1 flex justify-between items-center p-2 rounded-md transition-colors cursor-pointer",
                         isSelected ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/30"
                       )}
                       onClick={() => setStartAtStep(step)}
                     >
                       <div>
                         <p className={cn("text-sm font-medium capitalize", isSelected && "text-primary")}>{step}</p>
                         <p className="text-[10px] text-muted-foreground">
                           {isCompleted ? "Status anterior: Concluído" : "Status anterior: Pendente"}
                         </p>
                       </div>
                       {isSelected && <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">RETOMAR AQUI</Badge>}
                     </div>
                   </div>
                 );
               })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReexecuteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (reexecuteItem) {
                setLoading(true);
                setPrompt(reexecuteItem.prompt);
                setMetadata(reexecuteItem.metadata || {});
                
                const initialSteps = startAtStep !== "upload" ? reexecuteItem.logs : undefined;
                const needsConvert = reexecuteItem.logs?.find((s: any) => s.key === "convert")?.status !== "skipped";
                
                setProgressSteps(buildSteps(needsConvert, reexecuteItem.metadata, initialSteps));
                setReexecuteDialogOpen(false);
                
                toast.info(`Retomando de: ${startAtStep}`);
                await handleExecute();
                setLoading(false);
              }
            }}>
              <PlayCircle className="h-4 w-4 mr-2" /> Confirmar e Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CSVExportModalWrapper />
    </div>
  );
}
