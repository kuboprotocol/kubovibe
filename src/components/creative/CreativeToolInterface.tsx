import heic2any from "heic2any";
import { useState, useEffect, useCallback } from "react";
import { 
  MessageSquare, ImageIcon, Download, Scissors, User2, Video, Music, BookOpen, Sparkles,
  Loader2, Send, Coins, Settings2, Info, AlertCircle, Wallet, RotateCw, Upload, X, 
  Download as DownloadIcon, Crop as CropIcon, Trash2, Sliders, History, FileText, FileCode, 
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarCropDialog } from "./AvatarCropDialog";
import { AvatarProgressSteps, type AvatarStepState, type AvatarStepKey } from "./AvatarProgressSteps";
import { cn } from "@/lib/utils";
import { PUTER_MODELS, creativeInvoke } from "@/lib/puterAI";

type ToolKey = "chat" | "nano_banana" | "downloader" | "clips" | "avatar" | "shorts" | "music" | "ebook" | "emo";

interface Props {
  toolKey: ToolKey;
  onSuccess?: () => void;
}

const TOOLS: { key: ToolKey; title: string; desc: string; icon: any; cost: string }[] = [
  { key: "chat", title: "Kubo Chat", desc: "Conversas, resumos, traduções, geração de textos", icon: MessageSquare, cost: "1 crédito" },
  { key: "nano_banana", title: "Imagens Premium", desc: "Criação de imagens de alta qualidade", icon: ImageIcon, cost: "1 crédito" },
  { key: "downloader", title: "Downloader Universal", desc: "YouTube, Instagram, TikTok, Facebook", icon: Download, cost: "2 créditos" },
  { key: "clips", title: "Kubo Clips", desc: "Cortes virais automáticos", icon: Scissors, cost: "1 crédito" },
  { key: "avatar", title: "Kubo Avatar AI", desc: "Avatares falantes realistas", icon: User2, cost: "2–4 créditos" },
  { key: "shorts", title: "Kubo Shorts", desc: "Vídeos curtos a partir de texto", icon: Video, cost: "3 créditos" },
  { key: "music", title: "MusKAI Music", desc: "Redireciona para MusKAI", icon: Music, cost: "Externo" },
  { key: "ebook", title: "Kubo Ebook AI", desc: "eBooks completos com capítulos", icon: BookOpen, cost: "10 créditos" },
  { key: "emo", title: "Kubo EMO AI", desc: "Animação realista de fotos", icon: Sparkles, cost: "5 créditos" },
];

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
    title: "Imagens Premium", 
    description: "Criação de imagens de alta qualidade (Pollinations/Gemini).", 
    cost: 1,
    promptLabel: "Descreva a imagem",
    placeholder: "Um astronauta andando a cavalo em Marte, estilo futurista...",
    options: [
      { key: "size", label: "Tamanho", type: "select", options: ["1024x1024", "1024x1792", "1792x1024"], default: "1024x1024" },
      { key: "engine", label: "Motor", type: "select", options: ["Padrão (Pollinations)", "Premium (Gemini)"], default: "Padrão (Pollinations)" }
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
    title: "MusKAI Music", 
    description: "Criação de músicas profissionais via MusKAI.", 
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

const TOOL_TO_FN: Record<string, string> = {
  chat: "creative-router",
  nano_banana: "creative-router",
  downloader: "creative-download",
  clips: "creative-clips",
  avatar: "creative-video",
  shorts: "creative-video",
  music: "creative-router",
  ebook: "creative-ebook",
  emo: "emo-animate",
};

export function CreativeToolInterface({ toolKey, onSuccess }: Props) {
  const config = TOOL_CONFIGS[toolKey];
  const { editsRemaining } = useSubscription();
  const [prompt, setPrompt] = useState("");
  const [metadata, setMetadata] = useState<Record<string, any>>(
    config.options?.reduce((acc, opt) => ({ ...acc, [opt.key]: opt.default }), {}) || {}
  );
  const [loading, setLoading] = useState(false);
  const [kimiModel, setKimiModel] = useState<string>(() => localStorage.getItem("creative_kimi_model") || "meta-llama/llama-3.1-70b-instruct");
  const [temperature, setTemperature] = useState(() => Number(localStorage.getItem("creative_temperature")) || 0.7);
  const [maxTokens, setMaxTokens] = useState(() => Number(localStorage.getItem("creative_max_tokens")) || 1500);
  const [streamingContent, setStreamingContent] = useState("");
  const [traceInfo, setTraceInfo] = useState<{ correlationId?: string; traceId?: string } | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; correlationId?: string; traceId?: string; stack?: string } | null>(null);
  const [executionPhase, setExecutionPhase] = useState<"idle" | "validating" | "requesting" | "processing" | "done" | "error">("idle");
  const [sessionHistory, setSessionHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem(`creative_history_${toolKey}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(`creative_history_${toolKey}`, JSON.stringify(sessionHistory));
  }, [sessionHistory, toolKey]);

  const handleExecute = async () => {
    if (loading) return;
    
    if (toolKey === "music" || toolKey === "shorts") {
      window.open("https://muskai.kubovibe.dev", "_blank");
      toast.info("Redirecionando para MusKAI...");
      return;
    }

    if (!prompt.trim()) {
      toast.error("O campo de prompt/URL é obrigatório");
      return;
    }

    setLoading(true);
    setExecutionPhase("requesting");
    setStreamingContent("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let body: any = { tool: toolKey === "nano_banana" ? "image" : toolKey, prompt, metadata };
      
      if (toolKey === "chat") {
        body.messages = [{ role: "user", content: prompt }];
        body.model = kimiModel;
        body.temperature = temperature;
        body.max_tokens = maxTokens;
      }

      const { data, error } = await supabase.functions.invoke("creative-router", {
        body
      });

      if (error) throw error;

      setSessionHistory(prev => [{
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        prompt,
        status: "success",
        assetUrl: data?.image_url || data?.asset_url,
        output_text: data?.output || (typeof data === 'string' ? data : null),
        metadata: { ...metadata, model: kimiModel, engine: data?.engine }
      }, ...prev].slice(0, 50));

      setExecutionPhase("done");
      toast.success("Solicitação processada com sucesso!");
      setPrompt("");
      onSuccess?.();
    } catch (e: any) {
      setExecutionPhase("error");
      toast.error("Erro na execução", { description: e.message });
      setSessionHistory(prev => [{
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        prompt,
        status: "error",
        metadata: { ...metadata }
      }, ...prev].slice(0, 50));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="p-6 bg-background/40 backdrop-blur-xl border-border/10 border-gold/10 relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gold/10 text-gold shadow-[0_0_15px_rgba(201,148,26,0.1)] group-hover:shadow-[0_0_20px_rgba(201,148,26,0.2)] transition-all">
            {TOOLS.find(t => t.key === toolKey)?.icon && 
              (() => {
                const Icon = TOOLS.find(t => t.key === toolKey)?.icon;
                return <Icon className="h-6 w-6" />;
              })()
            }
          </div>
          <div>
            <h3 className="text-lg font-orbitron font-bold text-foreground tracking-tight">{config.title}</h3>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider opacity-60">{config.promptLabel}</Label>
            <Textarea
              placeholder={config.placeholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] bg-background/50 border-border/10 focus:border-gold/30 transition-all resize-none text-sm"
            />
          </div>

          {config.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {config.options.map((opt) => (
                <div key={opt.key} className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider opacity-60">{opt.label}</Label>
                  {opt.type === "select" ? (
                    <Select
                      value={metadata[opt.key]}
                      onValueChange={(val) => setMetadata(prev => ({ ...prev, [opt.key]: val }))}
                    >
                      <SelectTrigger className="bg-background/50 border-border/10 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {opt.options?.map(o => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : opt.type === "number" ? (
                    <Input
                      type="number"
                      value={metadata[opt.key]}
                      onChange={(e) => setMetadata(prev => ({ ...prev, [opt.key]: Number(e.target.value) }))}
                      className="bg-background/50 border-border/10"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {toolKey === "chat" && (
            <div className="p-4 rounded-xl bg-gold/5 border border-gold/10 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="h-4 w-4 text-gold" />
                <span className="text-xs font-bold uppercase tracking-widest text-gold/80">Configurações de IA</span>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase opacity-60">Modelo</Label>
                  <Select value={kimiModel} onValueChange={setKimiModel}>
                    <SelectTrigger className="h-9 bg-background/50 border-border/10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PUTER_MODELS.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase opacity-60">Temperatura: {temperature}</Label>
                    <Slider
                      value={[temperature]}
                      min={0} max={1} step={0.1}
                      onValueChange={([v]) => setTemperature(v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase opacity-60">Max Tokens: {maxTokens}</Label>
                    <Slider
                      value={[maxTokens]}
                      min={100} max={4000} step={100}
                      onValueChange={([v]) => setMaxTokens(v)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 border border-border/10">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500/90 tracking-tight">
                Custo: {config.cost} {config.cost === 1 ? 'crédito' : 'créditos'}
              </span>
            </div>
            
            <Button
              onClick={handleExecute}
              disabled={loading}
              className="bg-gold hover:bg-gold/90 text-black font-bold font-orbitron px-8 h-12 shadow-[0_0_20px_rgba(201,148,26,0.3)] hover:shadow-[0_0_30px_rgba(201,148,26,0.5)] transition-all group"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              )}
              {loading ? "PROCESSANDO..." : "EXECUTAR AGORA"}
            </Button>
          </div>
        </div>
      </Card>

      {sessionHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History className="h-4 w-4" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Histórico da Sessão</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessionHistory.map((item) => (
              <Card key={item.id} className="p-4 bg-background/20 backdrop-blur-md border-border/5 hover:border-gold/20 transition-all group overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] opacity-40 font-mono">{item.timestamp}</span>
                    <Badge variant={item.status === "success" ? "secondary" : "destructive"} className="text-[8px] h-4 uppercase">
                      {item.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                  </div>
                  {item.metadata?.credits && (
                    <span className="text-[10px] font-bold text-gold/60">-{item.metadata.credits} cred</span>
                  )}
                </div>
                
                <p className="text-xs text-foreground/90 font-medium line-clamp-2 mb-3 leading-relaxed">{item.prompt}</p>
                
                {item.assetUrl && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/40 border border-border/10 mb-3 group-hover:border-gold/30 transition-all">
                    <img src={item.assetUrl} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <a 
                      href={item.assetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                    >
                      <DownloadIcon className="h-6 w-6 text-gold" />
                    </a>
                  </div>
                )}

                {item.output_text && (
                  <div className="p-3 rounded-lg bg-black/40 text-[11px] text-muted-foreground/90 border border-border/10 line-clamp-4 leading-relaxed whitespace-pre-wrap italic">
                    {item.output_text}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
