import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Video, ImageIcon, Wand2, X, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRunway, type RunwayEndpoint } from "@/hooks/useRunway";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PHOTOREAL_SUFFIX =
  ", photorealistic, cinematic lighting, shallow depth of field, natural motion, 35mm film, ultra detailed, 4k";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional starting image URL (e.g. canvas export) pre-fills image_to_video. */
  defaultImageUrl?: string;
  /** Called with the first output URL once the task succeeds. */
  onResult?: (url: string, endpoint: RunwayEndpoint) => void;
}

/**
 * Self-contained dialog that drives the `runway-generate` edge function for
 * all four supported endpoints. Stays in the design system (gold/glass) and
 * shows polling progress + credit debit feedback.
 */
export default function RunwayDialog({ open, onOpenChange, defaultImageUrl, onResult }: Props) {
  const { state, generate, reset } = useRunway();

  // text_to_image
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgRatio, setImgRatio] = useState("1024:1024");
  // image_to_video
  const [vidPrompt, setVidPrompt] = useState("");
  const [vidImage, setVidImage] = useState(defaultImageUrl ?? "");
  const [vidDuration, setVidDuration] = useState<5 | 10>(5);
  const [vidPhotoreal, setVidPhotoreal] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // video_upscale
  const [upscaleUrl, setUpscaleUrl] = useState("");
  // character_performance
  const [charRefVideo, setCharRefVideo] = useState("");
  const [charCharacterImg, setCharCharacterImg] = useState("");

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? "anon";
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `runway/${uid}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      setVidImage(data.publicUrl);
      toast({ title: "Foto enviada", description: "Pronta para virar vídeo." });
    } catch (e) {
      toast({ title: "Falha no upload", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const busy = state.status === "starting" || state.status === "polling";

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const firstOutput = state.output?.[0] ?? null;
  if (state.status === "done" && firstOutput && onResult) {
    // fire-and-forget to parent; parent decides what to do with the asset.
    onResult(firstOutput, "image_to_video");
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-orbitron tracking-wide">
            <Sparkles className="h-5 w-5 text-primary" />
            RunwayML — Geração de mídia
          </DialogTitle>
          <DialogDescription>
            Cada geração consome <strong>28 créditos</strong>. Tarefas rodam em background;
            o resultado aparece aqui assim que pronto.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="image_to_video" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="image_to_video"><Video className="h-3.5 w-3.5 mr-1" />Vídeo</TabsTrigger>
            <TabsTrigger value="text_to_image"><ImageIcon className="h-3.5 w-3.5 mr-1" />Imagem</TabsTrigger>
            <TabsTrigger value="video_upscale"><Wand2 className="h-3.5 w-3.5 mr-1" />Upscale</TabsTrigger>
            <TabsTrigger value="character_performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="image_to_video" className="space-y-3 pt-4">
            <Label>Imagem de origem (URL pública)</Label>
            <Input value={vidImage} onChange={(e) => setVidImage(e.target.value)} placeholder="https://…" />
            <Label>Prompt</Label>
            <Textarea value={vidPrompt} onChange={(e) => setVidPrompt(e.target.value)} placeholder="Cinematic dolly zoom, golden hour…" rows={3} />
            <div className="flex items-center gap-3">
              <Label>Duração</Label>
              <Button type="button" size="sm" variant={vidDuration === 5 ? "default" : "outline"} onClick={() => setVidDuration(5)}>5s</Button>
              <Button type="button" size="sm" variant={vidDuration === 10 ? "default" : "outline"} onClick={() => setVidDuration(10)}>10s</Button>
            </div>
            <Button
              disabled={busy || !vidImage.trim() || !vidPrompt.trim()}
              onClick={() => generate("image_to_video", {
                model: "gen4_turbo",
                promptText: vidPrompt,
                promptImage: vidImage,
                ratio: "1280:720",
                duration: vidDuration,
              })}
              className="w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar vídeo (28 créditos)
            </Button>
          </TabsContent>

          <TabsContent value="text_to_image" className="space-y-3 pt-4">
            <Label>Prompt</Label>
            <Textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} rows={3} placeholder="Photoreal cyberpunk skyline…" />
            <Label>Ratio</Label>
            <Input value={imgRatio} onChange={(e) => setImgRatio(e.target.value)} placeholder="1024:1024" />
            <Button
              disabled={busy || !imgPrompt.trim()}
              onClick={() => generate("text_to_image", {
                model: "gen4_image",
                promptText: imgPrompt,
                ratio: imgRatio,
              })}
              className="w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar imagem (28 créditos)
            </Button>
          </TabsContent>

          <TabsContent value="video_upscale" className="space-y-3 pt-4">
            <Label>URL do vídeo</Label>
            <Input value={upscaleUrl} onChange={(e) => setUpscaleUrl(e.target.value)} placeholder="https://…/clip.mp4" />
            <Button
              disabled={busy || !upscaleUrl.trim()}
              onClick={() => generate("video_upscale", { videoUri: upscaleUrl, model: "upscale_v1" })}
              className="w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Upscale (28 créditos)
            </Button>
          </TabsContent>

          <TabsContent value="character_performance" className="space-y-3 pt-4">
            <Label>Vídeo de referência (movimento)</Label>
            <Input value={charRefVideo} onChange={(e) => setCharRefVideo(e.target.value)} placeholder="https://…/reference.mp4" />
            <Label>Imagem do personagem</Label>
            <Input value={charCharacterImg} onChange={(e) => setCharCharacterImg(e.target.value)} placeholder="https://…/character.png" />
            <Button
              disabled={busy || !charRefVideo.trim() || !charCharacterImg.trim()}
              onClick={() => generate("character_performance", {
                model: "act_two",
                character: { type: "image", uri: charCharacterImg },
                reference: { type: "video", uri: charRefVideo },
              })}
              className="w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar performance (28 créditos)
            </Button>
          </TabsContent>
        </Tabs>

        {/* Status */}
        {state.status !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
          >
            {state.status === "starting" && <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Enviando para Runway…</p>}
            {state.status === "polling"  && (
              <p className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Processando ({Math.round((state.progress ?? 0) * 100)}%)
                {state.taskId && <span className="text-muted-foreground text-xs ml-2">task <code>{state.taskId.slice(0, 8)}</code></span>}
              </p>
            )}
            {state.status === "error"   && <p className="text-destructive flex items-center gap-2"><X className="h-4 w-4" />{state.error}</p>}
            {state.status === "done" && firstOutput && (
              <div className="space-y-2">
                <p className="text-emerald-500">Pronto — {state.output?.length} arquivo(s).</p>
                {firstOutput.match(/\.(mp4|webm|mov)$/i)
                  ? <video src={firstOutput} controls className="w-full rounded-md" />
                  : <img src={firstOutput} alt="Resultado Runway" className="w-full rounded-md" />}
                <a href={firstOutput} download target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full"><Download className="h-4 w-4 mr-2" />Baixar</Button>
                </a>
              </div>
            )}
            {(state.creditsDebited > 0 || state.balanceAfter != null) && (
              <p className="text-xs text-muted-foreground mt-2">
                {state.creditsDebited > 0 ? `−${state.creditsDebited} créditos` : "sem cobrança (replay)"}{" "}
                {state.balanceAfter != null && `· saldo ${state.balanceAfter}`}
              </p>
            )}
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
