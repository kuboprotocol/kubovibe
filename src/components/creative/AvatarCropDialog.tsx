import { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Crop as CropIcon, ZoomIn, Square, Maximize, Save, Trash2, List, Pencil, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  imageUrl: string | null;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob, preset: { zoom: number; aspect: number }) => void | Promise<void>;
  onSavePreset: (name: string, preset: { zoom: number; aspect: number }) => void;
  initialPreset?: { zoom: number; aspect: number };
}

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context indisponível");

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))),
      "image/png",
      0.95
    );
  });
}

export function AvatarCropDialog({ open, imageUrl, onCancel, onConfirm, onSavePreset, initialPreset }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialPreset?.zoom || 1);
  const [aspect, setAspect] = useState(initialPreset?.aspect || 1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [presets, setPresets] = useState<{ name: string; zoom: number; aspect: number }[]>(() => {
    const saved = localStorage.getItem("creative_avatar_presets_list");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (initialPreset) {
      setZoom(initialPreset.zoom);
      setAspect(initialPreset.aspect);
    }
  }, [initialPreset]);

  const saveToPresetsList = (name: string, p: { zoom: number; aspect: number }) => {
    if (!name.trim()) return;
    
    const exists = presets.find(x => x.name.toLowerCase() === name.toLowerCase() && x.name !== editingPreset);
    if (exists) {
      toast.error("Já existe um preset com este nome");
      return;
    }

    let newPresets;
    if (editingPreset) {
      newPresets = presets.map(x => x.name === editingPreset ? { ...x, name, ...p } : x);
      setEditingPreset(null);
      toast.success("Preset renomeado");
    } else {
      newPresets = [...presets, { name, ...p }];
      toast.success("Preset salvo");
    }

    setPresets(newPresets);
    localStorage.setItem("creative_avatar_presets_list", JSON.stringify(newPresets));
    onSavePreset(name, p);
    setPresetName("");
  };

  const duplicatePreset = (name: string) => {
    const original = presets.find(p => p.name === name);
    if (!original) return;
    
    let newName = `${name} (Cópia)`;
    let counter = 1;
    while (presets.find(p => p.name === newName)) {
      newName = `${name} (Cópia ${counter})`;
      counter++;
    }
    
    const newPresets = [...presets, { ...original, name: newName }];
    setPresets(newPresets);
    localStorage.setItem("creative_avatar_presets_list", JSON.stringify(newPresets));
    toast.success("Preset duplicado");
  };

  const startEditing = (preset: typeof presets[0]) => {
    setPresetName(preset.name);
    setEditingPreset(preset.name);
  };

  const deletePreset = (name: string) => {
    const newPresets = presets.filter(p => p.name !== name);
    setPresets(newPresets);
    localStorage.setItem("creative_avatar_presets_list", JSON.stringify(newPresets));
    toast.success("Preset removido");
  };

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageUrl || !croppedArea) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageUrl, croppedArea);
      await onConfirm(blob, { zoom, aspect });
    } finally {
      setProcessing(false);
    }
  };

  const aspectOptions = [
    { label: "1:1 (Quadrado)", value: 1 },
    { label: "4:5 (Retrato)", value: 0.8 },
    { label: "9:16 (Story)", value: 0.5625 },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl bg-card border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5 text-primary" /> Ajustar Avatar
          </DialogTitle>
          <DialogDescription>
            Prepare seu avatar com zoom e proporção de recorte ideal.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[360px] bg-black/40 rounded-lg overflow-hidden">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape="rect"
              showGrid={true}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
                <Label className="text-xs text-muted-foreground">Proporção</Label>
                <Select value={aspect.toString()} onValueChange={(v) => setAspect(parseFloat(v))}>
                    <SelectTrigger>
                        <SelectValue placeholder="Escolha proporção" />
                    </SelectTrigger>
                    <SelectContent>
                        {aspectOptions.map(o => <SelectItem key={o.value} value={o.value.toString()}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-1 space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Maximize className="h-3 w-3"/> Ajustar & Presets</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-[10px] h-8" onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); }}>Resetar</Button>
                  <Select onValueChange={(v) => {
                    const p = presets.find(x => x.name === v);
                    if (p) { setZoom(p.zoom); setAspect(p.aspect); }
                  }}>
                    <SelectTrigger className="flex-1 text-[10px] h-8">
                      <List className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Presets" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.length === 0 && <div className="p-2 text-[10px] text-center opacity-50">Nenhum salvo</div>}
                      {presets.map(p => (
                        <div key={p.name} className="flex items-center justify-between group">
                          <SelectItem value={p.name} className="flex-1">{p.name}</SelectItem>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100" 
                            onClick={(e) => { e.stopPropagation(); deletePreset(p.name); }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
            </div>
          </div>

          <div className="flex items-end gap-2 p-2 rounded bg-primary/5 border border-primary/10">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-primary/70">{editingPreset ? "Renomear Preset" : "Novo Preset"}</Label>
              <Input 
                placeholder="Nome do ajuste..." 
                value={presetName} 
                onChange={(e) => setPresetName(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
            <Button 
              size="sm" 
              className="h-8 text-xs" 
              disabled={!presetName.trim()}
              onClick={() => saveToPresetsList(presetName, { zoom, aspect })}
            >
              <Save className="h-3 w-3 mr-1" /> {editingPreset ? "Atualizar" : "Salvar"}
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-2 text-muted-foreground">
              <ZoomIn className="h-3 w-3" /> Zoom ({zoom.toFixed(1)}x)
            </Label>
            <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedArea}>
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CropIcon className="h-4 w-4 mr-2" />}
            Confirmar e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
