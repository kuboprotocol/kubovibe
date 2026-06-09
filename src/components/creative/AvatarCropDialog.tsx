import { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Crop as CropIcon, ZoomIn, Square, Maximize, Save, Trash2, List, Pencil, Copy, Download, Upload, AlertTriangle } from "lucide-react";
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
  const [importConflicts, setImportConflicts] = useState<{ name: string; zoom: number; aspect: number }[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
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
      if (!confirm(`Deseja salvar as alterações no preset "${editingPreset}"?`)) return;
      newPresets = presets.map(x => x.name === editingPreset ? { ...x, name, ...p } : x);
      setEditingPreset(null);
      toast.success("Preset atualizado");
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

  const importPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) throw new Error("Formato inválido");
        
        const validPresets = imported.filter(p => p.name && typeof p.zoom === "number" && typeof p.aspect === "number");
        if (validPresets.length === 0) throw new Error("Nenhum preset válido encontrado");

        const conflicts = validPresets.filter(p => presets.some(x => x.name.toLowerCase() === p.name.toLowerCase()));
        const nonConflicts = validPresets.filter(p => !presets.some(x => x.name.toLowerCase() === p.name.toLowerCase()));

        if (conflicts.length > 0) {
          setImportConflicts(conflicts);
          setShowConflicts(true);
          // Adiciona os não conflitantes primeiro
          if (nonConflicts.length > 0) {
            const newPresets = [...presets, ...nonConflicts];
            setPresets(newPresets);
            localStorage.setItem("creative_avatar_presets_list", JSON.stringify(newPresets));
          }
        } else {
          const newPresets = [...presets, ...validPresets];
          setPresets(newPresets);
          localStorage.setItem("creative_avatar_presets_list", JSON.stringify(newPresets));
          toast.success(`Importação concluída: ${validPresets.length} presets adicionados.`);
        }
      } catch (err) {
        toast.error("Erro ao importar arquivo JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConflictResolve = (preset: { name: string; zoom: number; aspect: number }, action: "overwrite" | "keep" | "rename") => {
    let newPresets = [...presets];
    if (action === "overwrite") {
      newPresets = newPresets.filter(p => p.name.toLowerCase() !== preset.name.toLowerCase());
      newPresets.push(preset);
      toast.info(`Preset "${preset.name}" sobrescrito`);
    } else if (action === "rename") {
      let newName = `${preset.name} (Importado)`;
      let counter = 1;
      while (newPresets.find(p => p.name.toLowerCase() === newName.toLowerCase()) || importConflicts.find(p => p.name.toLowerCase() === newName.toLowerCase() && p.name !== preset.name)) {
        newName = `${preset.name} (Importado ${counter})`;
        counter++;
      }
      newPresets.push({ ...preset, name: newName });
      toast.info(`Preset renomeado para "${newName}"`);
    }
    
    setPresets(newPresets);
    localStorage.setItem("creative_avatar_presets_list", JSON.stringify(newPresets));
    
    const remaining = importConflicts.filter(p => p.name !== preset.name);
    setImportConflicts(remaining);
    if (remaining.length === 0) setShowConflicts(false);
  };

  const exportPresets = () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kubo-avatar-presets.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deletePreset = (name: string) => {
    if (confirm(`Tem certeza que deseja excluir o preset "${name}"?`)) {
      const newPresets = presets.filter(p => p.name !== name);
      setPresets(newPresets);
      localStorage.setItem("creative_avatar_presets_list", JSON.stringify(newPresets));
      toast.success("Preset removido");
    }
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
                <Label className="text-xs text-muted-foreground flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1"><Maximize className="h-3 w-3"/> Ajustar & Presets</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-4 w-4" onClick={exportPresets} title="Exportar Presets">
                      <Download className="h-3 w-3" />
                    </Button>
                    <Label htmlFor="import-presets" className="cursor-pointer">
                      <div className="h-4 w-4 inline-flex items-center justify-center rounded-sm hover:bg-muted" title="Importar Presets">
                        <Upload className="h-3 w-3" />
                      </div>
                      <Input id="import-presets" type="file" accept=".json" className="hidden" onChange={importPresets} />
                    </Label>
                  </div>
                </Label>
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
                        <div key={p.name} className="flex items-center justify-between group px-2 py-1 hover:bg-muted/50 rounded-sm">
                          <SelectItem value={p.name} className="flex-1 cursor-pointer">{p.name}</SelectItem>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6" 
                              onClick={(e) => { e.stopPropagation(); startEditing(p); }}
                              title="Renomear"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6" 
                              onClick={(e) => { e.stopPropagation(); duplicatePreset(p.name); }}
                              title="Duplicar"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6" 
                              onClick={(e) => { e.stopPropagation(); deletePreset(p.name); }}
                              title="Excluir"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
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

      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className="max-w-md bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> Conflitos de Importação
            </DialogTitle>
            <DialogDescription>
              Os seguintes presets já existem. Escolha como deseja prosseguir para cada um.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {importConflicts.map((p) => (
              <div key={p.name} className="p-3 border rounded-lg space-y-3 bg-muted/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">Conflito</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => handleConflictResolve(p, "overwrite")}>Sobrescrever</Button>
                  <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => handleConflictResolve(p, "rename")}>Renomear</Button>
                  <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => handleConflictResolve(p, "keep")}>Pular</Button>
                </div>
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConflicts(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
