import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Upload, FileArchive, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ADMIN_EMAIL = "kuboprotocol@gmail.com";

type SkillImport = {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  status: "pending" | "registered" | "failed";
  notes: string | null;
  created_at: string;
};

const statusMeta = {
  pending: { icon: Clock, label: "Pendente", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  registered: { icon: CheckCircle2, label: "Registrada", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  failed: { icon: XCircle, label: "Falhou", className: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
} as const;

export default function AdminSkillsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<SkillImport[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("skill_imports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Falha ao carregar histórico");
      return;
    }
    setItems((data ?? []) as SkillImport[]);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchItems();
  }, [isAdmin, fetchItems]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!user) return;
      const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".zip"));
      if (list.length === 0) {
        toast.error("Apenas arquivos .zip são aceitos");
        return;
      }
      setBusy(true);
      try {
        for (const file of list) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${user.id}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("skill-uploads")
            .upload(path, file, { contentType: "application/zip", upsert: false });
          if (upErr) throw upErr;

          const { error: insErr } = await supabase.from("skill_imports").insert({
            uploaded_by: user.id,
            file_name: file.name,
            storage_path: path,
            size_bytes: file.size,
            status: "pending",
            notes: "Aguardando registro pelo agente. Mencione este upload no chat para iniciar.",
          });
          if (insErr) throw insErr;

          toast.success(`${file.name} enviado — peça ao agente para registrar`);
        }
        await fetchItems();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no upload";
        toast.error(msg);
      } finally {
        setBusy(false);
      }
    },
    [user, fetchItems]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold font-orbitron tracking-tight">Skills · Upload &amp; Registro</h1>
          <p className="text-sm text-muted-foreground">
            Anexe o ZIP da skill. O upload é privado e fica aguardando o agente extrair, validar e
            registrar em <code className="text-primary">.workspace/skills/</code>.
          </p>
        </header>

        <Card
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`p-10 border-2 border-dashed transition-colors text-center ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-card/40"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              {busy ? (
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              ) : (
                <Upload className="w-7 h-7 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium">Arraste o .zip aqui</p>
              <p className="text-xs text-muted-foreground mt-1">
                ou selecione manualmente · máx 20 MB · sem <code>.git/</code> interno
              </p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".zip,application/zip"
                multiple
                className="hidden"
                disabled={busy}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <Button asChild disabled={busy} variant="default">
                <span>{busy ? "Enviando..." : "Selecionar ZIP"}</span>
              </Button>
            </label>
          </div>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Histórico de uploads</h2>
          {items.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">
              Nenhum ZIP enviado ainda.
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((it) => {
                const meta = statusMeta[it.status];
                const Icon = meta.icon;
                return (
                  <Card key={it.id} className="p-4 flex items-center gap-4">
                    <FileArchive className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{it.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(it.size_bytes ?? 0) > 0 && `${((it.size_bytes ?? 0) / 1024).toFixed(1)} KB · `}
                        {new Date(it.created_at).toLocaleString("pt-BR")}
                      </p>
                      {it.notes && <p className="text-xs text-muted-foreground mt-1">{it.notes}</p>}
                    </div>
                    <Badge variant="outline" className={meta.className}>
                      <Icon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </Badge>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card className="p-4 text-xs text-muted-foreground bg-muted/30">
          <strong className="text-foreground">Próximo passo:</strong> depois de enviar, abra o chat
          e diga <em>"registre o ZIP que acabei de enviar"</em>. O agente baixa do bucket
          <code className="text-primary"> skill-uploads</code>, valida ausência de
          <code> .git/</code>, move para <code>.agents/skills/&lt;nome&gt;/</code>, aplica via
          <code> skills--apply_draft</code> e atualiza <code>docs/SKILLS_ORCHESTRATION.md</code>.
        </Card>
      </div>
    </div>
  );
}
