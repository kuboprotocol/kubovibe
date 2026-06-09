import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Crop as CropIcon, ZoomIn } from "lucide-react";

interface Props {
  open: boolean;
  imageUrl: string | null;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => void | Promise<void>;
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

export function AvatarCropDialog({ open, imageUrl, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageUrl || !croppedArea) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageUrl, croppedArea);
      await onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl bg-card border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5 text-primary" /> Ajustar Avatar
          </DialogTitle>
          <DialogDescription>
            Use o zoom e arraste para enquadrar o rosto. Recomendado: rosto centralizado.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[360px] bg-black/40 rounded-lg overflow-hidden">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-2 text-muted-foreground">
              <ZoomIn className="h-3 w-3" /> Zoom ({zoom.toFixed(1)}x)
            </Label>
            <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Rotação ({rotation}°)</Label>
            <Slider value={[rotation]} min={0} max={360} step={1} onValueChange={(v) => setRotation(v[0])} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedArea}>
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CropIcon className="h-4 w-4 mr-2" />}
            Aplicar recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
