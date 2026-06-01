import { useEffect, useState, useCallback, useRef } from "react";
import { Navigate } from "react-router-dom";
import {
  Upload,
  FileArchive,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const ADMIN_EMAIL = "kuboprotocol@gmail.com";
const BUCKET = "skill-uploads";

type StepKey = "queued" | "uploading" | "recording" | "validating" | "extracting" | "registering" | "done";

type ProgressShape = { step: StepKey | string; percent: number };

type SkillImport = {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  status: "pending" | "registered" | "failed";
  notes: string | null;
  progress: ProgressShape | null;
  created_at: string;
};

const STEP_ORDER: StepKey[] = [
  "queued",
  "uploading",
  "recording",
  "validating",
  "extracting",
  "registering",
  "done",
];

const STEP_LABEL: Record<StepKey, string> = {
  queued: "Na fila",
  uploading: "Enviando ZIP",
  recording: "Registrando upload",
  validating: "Validando (sem .git/)",
  extracting: "Extraindo conteúdo",
  registering: "Aplicando skill",
  done: "Pronto",
};

const statusMeta = {
  pending: { icon: Clock, label: "Pendente", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  registered: { icon: CheckCircle2, label: "Registrada", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  failed: { icon: XCircle, label: "Falhou", className: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
} as const;

// Local-only state for files currently being uploaded by THIS tab
type LocalUpload = {
  tempId: string;
  fileName: string;
  size: number;
  percent: number;
  step: StepKey;
  error?: string;
};

export default function AdminSkillsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<SkillImport[]>([]);
  const [locals, setLocals] = useState<LocalUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const normalize = (row: Record<string, unknown>): SkillImport => {
    const p = row.progress as { step?: string; percent?: number } | null;
    return {
      ...(row as unknown as SkillImport),
      progress: p && typeof p === "object"
        ? { step: (p.step as StepKey) ?? "queued", percent: Number(p.percent ?? 0) }
        : { step: "queued", percent: 0 },
    };
  };

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("skill_imports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Falha ao carregar histórico");
      return;
    }
    setItems((data ?? []).map((r) => normalize(r as Record<string, unknown>)));
  }, []);

  // Initial load + Realtime subscription for live status/progress updates
  useEffect(() => {
    if (!isAdmin) return;
    void fetchItems();

    const channel = supabase
      .channel("skill_imports_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "skill_imports" },
        (payload) => {
          setItems((prev) => {
          if (payload.eventType === "DELETE") {
              return prev.filter((it) => it.id !== (payload.old as { id: string }).id);
            }
            const row = normalize(payload.new as Record<string, unknown>);
            const idx = prev.findIndex((it) => it.id === row.id);
            if (idx === -1) return [row, ...prev];
            const copy = prev.slice();
            copy[idx] = row;
            return copy;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isAdmin, fetchItems]);

  const patchLocal = (tempId: string, patch: Partial<LocalUpload>) =>
    setLocals((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));

  const removeLocal = (tempId: string) =>
    setLocals((prev) => prev.filter((l) => l.tempId !== tempId));

  // Upload one file via signed upload URL + XHR (real progress)
  const uploadOne = useCallback(
    async (file: File) => {
      if (!user) return;
      const tempId = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;

      setLocals((prev) => [
        ...prev,
        { tempId, fileName: file.name, size: file.size, percent: 0, step: "queued" },
      ]);

      try {
        // 1) Create signed upload URL (works under our admin RLS)
        patchLocal(tempId, { step: "uploading", percent: 1 });
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUploadUrl(path);
        if (signErr || !signed) throw signErr ?? new Error("signed_url_failed");

        // 2) XHR PUT with real upload progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signed.signedUrl, true);
          xhr.setRequestHeader("Content-Type", "application/zip");
          xhr.setRequestHeader("x-upsert", "false");
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const pct = Math.max(1, Math.min(99, Math.round((e.loaded / e.total) * 100)));
            patchLocal(tempId, { percent: pct });
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`upload_http_${xhr.status}`));
          xhr.onerror = () => reject(new Error("upload_network_error"));
          xhr.send(file);
        });

        // 3) Insert skill_imports row → triggers Realtime update for everyone
        patchLocal(tempId, { step: "recording", percent: 100 });
        const { error: insErr } = await supabase.from("skill_imports").insert({
          uploaded_by: user.id,
          file_name: file.name,
          storage_path: path,
          size_bytes: file.size,
          status: "pending",
          notes: "Aguardando o agente. Diga 'registre o ZIP que acabei de enviar' no chat.",
          progress: { step: "queued", percent: 0 },
        });
        if (insErr) throw insErr;

        toast.success(`${file.name} enviado`);
        // Local card auto-dismiss; the realtime-driven server row takes over
        setTimeout(() => removeLocal(tempId), 1200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "upload_failed";
        patchLocal(tempId, { error: msg });
        toast.error(`Falha em ${file.name}: ${msg}`);
      }
    },
    [user]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".zip"));
      if (list.length === 0) {
        toast.error("Apenas arquivos .zip são aceitos");
        return;
      }
      // Upload in parallel (one progress bar each)
      await Promise.all(list.map(uploadOne));
    },
    [uploadOne]
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
          <h1 className="text-3xl md:text-4xl font-bold font-orbitron tracking-tight">
            Skills · Upload &amp; Registro
          </h1>
          <p className="text-sm text-muted-foreground">
            Arraste o ZIP. Progresso ao vivo durante o upload e cada etapa do registro
            aparece em tempo real graças ao Realtime.
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
              <Upload className="w-7 h-7 text-primary" />
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
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <Button asChild variant="default">
                <span>Selecionar ZIP</span>
              </Button>
            </label>
          </div>
        </Card>

        {/* Live local uploads (this tab only) */}
        {locals.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Enviando agora</h2>
            <div className="space-y-2">
              {locals.map((u) => (
                <Card key={u.tempId} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <FileArchive className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {(u.size / 1024).toFixed(1)} KB · {STEP_LABEL[u.step]}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {u.percent}%
                    </span>
                  </div>
                  <Progress value={u.percent} className="h-2" />
                  {u.error && (
                    <p className="text-xs text-rose-400">Erro: {u.error}</p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* History — driven by Realtime, shows step-by-step progress per item */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Histórico &amp; progresso ao vivo</h2>
          {items.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">
              Nenhum ZIP enviado ainda.
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((it) => {
                const meta = statusMeta[it.status];
                const Icon = meta.icon;
                const prog = it.progress ?? { step: "queued", percent: 0 };
                const currentIdx = STEP_ORDER.indexOf(prog.step as StepKey);
                return (
                  <Card key={it.id} className="p-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <FileArchive className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{it.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(it.size_bytes ?? 0) > 0 &&
                            `${((it.size_bytes ?? 0) / 1024).toFixed(1)} KB · `}
                          {new Date(it.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Badge variant="outline" className={meta.className}>
                        <Icon className="w-3 h-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>

                    {/* Live progress bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {STEP_LABEL[(prog.step as StepKey) ?? "queued"] ?? prog.step}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {prog.percent}%
                        </span>
                      </div>
                      <Progress
                        value={prog.percent}
                        className={`h-2 ${it.status === "failed" ? "[&>div]:bg-rose-500" : ""}`}
                      />
                    </div>

                    {/* Stepper */}
                    <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {STEP_ORDER.map((step, i) => {
                        const reached = i <= currentIdx || it.status === "registered";
                        const isCurrent = i === currentIdx && it.status === "pending";
                        const failed = it.status === "failed" && i === currentIdx;
                        return (
                          <li
                            key={step}
                            className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 border ${
                              failed
                                ? "border-rose-500/30 bg-rose-500/5 text-rose-400"
                                : reached
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                                : "border-border bg-muted/20 text-muted-foreground"
                            }`}
                          >
                            {failed ? (
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                            ) : isCurrent ? (
                              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                            ) : reached ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <CircleDot className="w-3.5 h-3.5 shrink-0 opacity-40" />
                            )}
                            <span className="truncate">{STEP_LABEL[step]}</span>
                          </li>
                        );
                      })}
                    </ol>

                    {it.notes && (
                      <p className="text-xs text-muted-foreground italic">{it.notes}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card className="p-4 text-xs text-muted-foreground bg-muted/30">
          <strong className="text-foreground">Como o progresso ao vivo funciona:</strong> a barra
          durante o upload usa XHR direto no Storage (progresso real). Depois disso, o agente
          atualiza <code>skill_imports.progress</code> em cada etapa
          (<code>validating → extracting → registering → done</code>) e o card reflete
          instantaneamente via Supabase Realtime.
        </Card>
      </div>
    </div>
  );
}
