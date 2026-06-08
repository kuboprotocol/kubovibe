import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera, Image as ImageIcon, Paperclip, Monitor, Puzzle, Code2, Smartphone,
  Presentation, Wand2, Search, MessageSquare, Calendar, Table2, Music, Video, Scissors, BookOpen, Sparkles, User2, Download
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Item = {
  key: string;
  label: string;
  icon: any;
  badge?: string;
  onSelect: (ctx: { navigate: ReturnType<typeof useNavigate>; setActive: (k: any) => void }) => void;
  divider?: boolean;
};

interface Props {
  setActive: (key: string) => void;
}

const ITEMS: Item[] = [
  { key: "computer", label: "Conectar Meu Computador", icon: Monitor, onSelect: ({ navigate }) => navigate("/connectors") },
  { key: "skills", label: "Adicionar Habilidades", icon: Puzzle, onSelect: ({ navigate }) => navigate("/agents"), divider: true },
  { key: "site", label: "Criar website", icon: Code2, onSelect: ({ navigate }) => navigate("/builder") },
  { key: "apps", label: "Desenvolver aplicativos", icon: Smartphone, onSelect: ({ navigate }) => navigate("/builder?mode=app") },
  { key: "slides", label: "Criar slides", icon: Presentation, badge: "AI", onSelect: ({ setActive }) => setActive("slides") },
  { key: "image", label: "Criar imagem", icon: ImageIcon, badge: "AI", onSelect: ({ setActive }) => setActive("nano_banana") },
  { key: "edit_image", label: "Editar imagem", icon: Wand2, onSelect: ({ setActive }) => setActive("nano_banana") },
  { key: "research", label: "Wide Research", icon: Search, onSelect: ({ setActive }) => setActive("chat") },
  { key: "chat_mode", label: "Modo de conversa", icon: MessageSquare, onSelect: ({ setActive }) => setActive("chat") },
  { key: "schedule", label: "Tarefas agendadas", icon: Calendar, onSelect: ({ navigate }) => navigate("/creative/investigation") },
  { key: "sheet", label: "Criar planilha", icon: Table2, onSelect: ({ setActive }) => setActive("chat") },
  { key: "music", label: "Música IA", icon: Music, onSelect: ({ setActive }) => setActive("music") },
  { key: "shorts", label: "Shorts/Vídeo IA", icon: Video, onSelect: ({ setActive }) => setActive("shorts") },
  { key: "clips", label: "Cortes virais", icon: Scissors, onSelect: ({ setActive }) => setActive("clips") },
  { key: "avatar", label: "Avatar IA", icon: User2, onSelect: ({ setActive }) => setActive("avatar") },
  { key: "ebook", label: "Ebook IA", icon: BookOpen, onSelect: ({ setActive }) => setActive("ebook") },
  { key: "emo", label: "EMO — Animar foto", icon: Sparkles, onSelect: ({ setActive }) => setActive("emo") },
  { key: "downloader", label: "Downloader Universal", icon: Download, onSelect: ({ setActive }) => setActive("downloader") },
];

export function ManusLauncher({ setActive }: Props) {
  const navigate = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tiles = [
    { key: "camera", label: "Câmera", icon: Camera, onClick: () => cameraRef.current?.click() },
    { key: "image", label: "Imagem", icon: ImageIcon, onClick: () => imageRef.current?.click() },
    { key: "file", label: "Arquivo", icon: Paperclip, onClick: () => fileRef.current?.click() },
  ];

  const handleFile = (kind: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    toast.success(`${kind} pronto: ${f.name}`, { description: "Encaminhando para o fluxo criativo..." });
    setActive("nano_banana");
  };

  return (
    <div className="space-y-4">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile("Câmera")} />
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={handleFile("Imagem")} />
      <input ref={fileRef} type="file" hidden onChange={handleFile("Arquivo")} />

      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            onClick={t.onClick}
            className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/40 bg-card/60 backdrop-blur p-5 transition hover:bg-card hover:border-primary/40 active:scale-[0.98]"
          >
            <t.icon className="h-7 w-7 text-foreground/80 group-hover:text-primary" />
            <span className="text-sm text-foreground/90">{t.label}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden bg-card/40 backdrop-blur border-border/40">
        <ul className="divide-y divide-border/30">
          {ITEMS.map((it) => (
            <li key={it.key} className={it.divider ? "border-b border-border/40" : ""}>
              <button
                onClick={() => it.onSelect({ navigate, setActive })}
                className="w-full flex items-center gap-4 px-4 py-3.5 text-left transition hover:bg-muted/40 active:bg-muted/60"
              >
                <it.icon className="h-5 w-5 text-foreground/70 shrink-0" />
                <span className="flex-1 text-[15px] text-foreground/90">{it.label}</span>
                {it.badge && (
                  <span className="text-[10px] font-semibold rounded-md bg-primary/15 text-primary px-1.5 py-0.5">
                    {it.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
