import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Navigate } from "react-router-dom";
import {
  Upload,
  FileArchive,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CircleDot,
  X,
  RotateCw,
  StopCircle,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";


const BUCKET = "skill-uploads";

type StepKey =
  | "queued"
  | "uploading"
  | "recording"
  | "validating"
  | "extracting"
  | "registering"
  | "done";

type ProgressShape = { step: StepKey | string; percent: number };

type LogEntry = {
  step?: string;
  level?: "info" | "warn" | "error";
  message: string;
  at?: string;
};

type ValidationSummary = {
  ok?: boolean;
  skill_name?: string;
  description?: string;
  files_count?: number;
  total_bytes?: number;
  has_git?: boolean;
  has_skill_md?: boolean;
  warnings?: string[];
  errors?: string[];
};

type SkillImport = {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  status: "pending" | "registered" | "failed";
  notes: string | null;
  progress: ProgressShape | null;
  logs: LogEntry[];
  validation: ValidationSummary | null;
  cancel_requested: boolean;
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
  pending: {
    icon: Clock,
    label: "Pendente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  registered: {
    icon: CheckCircle2,
    label: "Registrada",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  failed: {
    icon: XCircle,
    label: "Falhou",
    className: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
} as const;

type LocalUpload = {
  tempId: string;
  fileName: string;
  size: number;
  percent: number;
  step: StepKey;
  error?: string;
  xhr?: XMLHttpRequest;
  aborted?: boolean;
  file: File;
  storagePath?: string;
  attempt?: number;
};

export default function AdminSkillsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<SkillImport[]>([]);
  const [locals, setLocals] = useState<LocalUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "registered" | "failed"
  >("all");
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentLocalRef = useRef<LocalUpload[]>([]);
  useEffect(() => {
    currentLocalRef.current = locals;
  }, [locals]);

  const { isAdmin } = useAuth();

  const normalize = (row: Record<string, unknown>): SkillImport => {
    const p = row.progress as { step?: string; percent?: number } | null;
    const logs = Array.isArray(row.logs) ? (row.logs as LogEntry[]) : [];
    const validation = (row.validation ?? null) as ValidationSummary | null;
    return {
      ...(row as unknown as SkillImport),
      logs,
      validation,
      cancel_requested: Boolean(row.cancel_requested),
      progress:
        p && typeof p === "object"
          ? {
              step: (p.step as StepKey) ?? "queued",
              percent: Number(p.percent ?? 0),
            }
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
              return prev.filter(
                (it) => it.id !== (payload.old as { id: string }).id
              );
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
    setLocals((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l))
    );

  const removeLocal = (tempId: string) =>
    setLocals((prev) => prev.filter((l) => l.tempId !== tempId));

  // Retry policy: max 4 attempts, 1s, 2s, 4s, 8s (cap 10s) with jitter
  const MAX_ATTEMPTS = 4;
  const backoffMs = (attempt: number) => {
    const base = Math.min(10_000, 1000 * 2 ** (attempt - 1));
    return base + Math.floor(Math.random() * 400);
  };

  const cancelLocal = useCallback(
    async (tempId: string) => {
      let storagePath: string | undefined;
      setLocals((prev) => {
        const target = prev.find((l) => l.tempId === tempId);
        if (target?.xhr) {
          try {
            target.xhr.abort();
          } catch {
            /* noop */
          }
        }
        storagePath = target?.storagePath;
        return prev.map((l) =>
          l.tempId === tempId
            ? { ...l, aborted: true, error: "Cancelado pelo usuário" }
            : l
        );
      });
      toast.message("Upload cancelado");

      // Best-effort cleanup of any half-uploaded object
      if (storagePath) {
        try {
          await supabase.functions.invoke("skill-import-cancel", {
            body: { action: "cancel-upload", storagePath },
          });
        } catch {
          /* noop */
        }
      }
      setTimeout(() => removeLocal(tempId), 1500);
    },
    []
  );

  const performUpload = useCallback(
    async (tempId: string, file: File, path: string) => {
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);
      if (signErr || !signed) throw signErr ?? new Error("signed_url_failed");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        patchLocal(tempId, { xhr });
        xhr.open("PUT", signed.signedUrl, true);
        xhr.setRequestHeader("Content-Type", "application/zip");
        xhr.setRequestHeader("x-upsert", "true");
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.max(
            1,
            Math.min(99, Math.round((e.loaded / e.total) * 100))
          );
          patchLocal(tempId, { percent: pct });
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`upload_http_${xhr.status}`));
        xhr.onerror = () => reject(new Error("upload_network_error"));
        xhr.onabort = () => reject(new Error("aborted"));
        xhr.send(file);
      });
    },
    []
  );

  const isRetryableError = (msg: string) => {
    if (msg === "aborted") return false;
    if (msg.startsWith("upload_http_4")) return false; // 4xx not retryable
    return true; // network errors, 5xx, signed-url failures
  };

  const uploadOne = useCallback(
    async (file: File) => {
      if (!user) return;
      const tempId = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;

      setLocals((prev) => [
        ...prev,
        {
          tempId,
          fileName: file.name,
          size: file.size,
          percent: 0,
          step: "queued",
          file,
          storagePath: path,
          attempt: 0,
        },
      ]);

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        patchLocal(tempId, {
          step: "uploading",
          percent: 1,
          attempt,
          error: undefined,
        });
        try {
          await performUpload(tempId, file, path);
          // success → record DB row
          patchLocal(tempId, { step: "recording", percent: 100 });
          const { error: insErr } = await supabase.from("skill_imports").insert({
            uploaded_by: user.id,
            file_name: file.name,
            storage_path: path,
            size_bytes: file.size,
            status: "pending",
            notes:
              attempt > 1
                ? `Enviado após ${attempt} tentativas. Diga 'registre o ZIP que acabei de enviar'.`
                : "Aguardando o agente. Diga 'registre o ZIP que acabei de enviar' no chat.",
            progress: { step: "queued", percent: 0 },
            logs: [],
            cancel_requested: false,
          });
          if (insErr) throw insErr;
          toast.success(
            attempt > 1
              ? `${file.name} enviado (tentativa ${attempt})`
              : `${file.name} enviado`
          );
          setTimeout(() => removeLocal(tempId), 1200);
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "upload_failed";
          if (msg === "aborted") return; // user cancelled
          const canRetry = isRetryableError(msg) && attempt < MAX_ATTEMPTS;
          if (!canRetry) {
            patchLocal(tempId, { error: msg, step: "uploading" });
            toast.error(
              `Falha em ${file.name} após ${attempt} tentativas: ${msg}`
            );
            return;
          }
          const wait = backoffMs(attempt);
          patchLocal(tempId, {
            error: `Tentativa ${attempt} falhou (${msg}). Retentando em ${Math.round(
              wait / 1000
            )}s…`,
            percent: 0,
          });
          // Cancellable wait: bail out if user aborted during backoff
          const aborted = await new Promise<boolean>((resolve) => {
            const t = setTimeout(() => resolve(false), wait);
            const iv = setInterval(() => {
              const cur = currentLocalRef.current.find(
                (l) => l.tempId === tempId
              );
              if (cur?.aborted) {
                clearTimeout(t);
                clearInterval(iv);
                resolve(true);
              }
            }, 150);
            setTimeout(() => clearInterval(iv), wait + 50);
          });
          if (aborted) return;
        }
      }
    },
    [user, performUpload]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.name.toLowerCase().endsWith(".zip")
      );
      if (list.length === 0) {
        toast.error("Apenas arquivos .zip são aceitos");
        return;
      }
      await Promise.all(list.map(uploadOne));
    },
    [uploadOne]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  const requestStop = async (id: string) => {
    const { error } = await supabase.functions.invoke("skill-import-cancel", {
      body: { action: "cancel-import", importId: id },
    });
    if (error) {
      toast.error("Não foi possível cancelar");
      return;
    }
    toast.message("Cancelamento confirmado pelo endpoint");
  };

  const retry = async (id: string) => {
    const { error } = await supabase
      .from("skill_imports")
      .update({
        status: "pending",
        cancel_requested: false,
        progress: { step: "queued", percent: 0 },
        logs: [],
        validation: null,
        notes:
          "Retentativa solicitada. Diga 'tente registrar de novo' no chat.",
      })
      .eq("id", id);
    if (error) {
      toast.error("Falha ao reenfileirar");
      return;
    }
    toast.success("Reenfileirado para nova tentativa");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (!q) return true;
      return (
        it.file_name.toLowerCase().includes(q) ||
        (it.notes ?? "").toLowerCase().includes(q) ||
        (it.validation?.skill_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      registered: items.filter((i) => i.status === "registered").length,
      failed: items.filter((i) => i.status === "failed").length,
    }),
    [items]
  );

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
            Arraste o ZIP. Progresso ao vivo, logs por etapa, cancelamento e
            retentativa.
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
                ou selecione manualmente · máx 20 MB · sem <code>.git/</code>{" "}
                interno
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
                        {(u.size / 1024).toFixed(1)} KB ·{" "}
                        {u.aborted ? "Cancelado" : STEP_LABEL[u.step]}
                        {u.attempt && u.attempt > 1 && !u.aborted
                          ? ` · tentativa ${u.attempt}/${4}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {u.percent}%
                    </span>
                    {!u.aborted && !u.error && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelLocal(u.tempId)}
                        className="h-7 px-2 text-rose-400 hover:text-rose-300"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
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

        {/* Search & filters */}
        <section className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por arquivo, skill ou notas..."
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as typeof statusFilter)
            }
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({counts.all})</SelectItem>
              <SelectItem value="pending">
                Pendentes ({counts.pending})
              </SelectItem>
              <SelectItem value="registered">
                Registradas ({counts.registered})
              </SelectItem>
              <SelectItem value="failed">Falhas ({counts.failed})</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Histórico &amp; progresso ao vivo
          </h2>
          {filtered.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">
              {items.length === 0
                ? "Nenhum ZIP enviado ainda."
                : "Nenhum resultado para os filtros atuais."}
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((it) => {
                const meta = statusMeta[it.status];
                const Icon = meta.icon;
                const prog = it.progress ?? { step: "queued", percent: 0 };
                const currentIdx = STEP_ORDER.indexOf(prog.step as StepKey);
                const logsOpen = openLogs[it.id] ?? false;
                const v = it.validation;

                return (
                  <Card key={it.id} className="p-4 space-y-4">
                    <div className="flex items-center gap-4 flex-wrap">
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
                      {it.cancel_requested && it.status === "pending" && (
                        <Badge
                          variant="outline"
                          className="bg-orange-500/10 text-orange-400 border-orange-500/30"
                        >
                          Cancelando...
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {STEP_LABEL[(prog.step as StepKey) ?? "queued"] ??
                            prog.step}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {prog.percent}%
                        </span>
                      </div>
                      <Progress
                        value={prog.percent}
                        className={`h-2 ${
                          it.status === "failed" ? "[&>div]:bg-rose-500" : ""
                        }`}
                      />
                    </div>

                    <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {STEP_ORDER.map((step, i) => {
                        const reached =
                          i <= currentIdx || it.status === "registered";
                        const isCurrent =
                          i === currentIdx && it.status === "pending";
                        const failed =
                          it.status === "failed" && i === currentIdx;
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
                            <span className="truncate">
                              {STEP_LABEL[step]}
                            </span>
                          </li>
                        );
                      })}
                    </ol>

                    {/* Validation summary */}
                    {v && (
                      <div
                        className={`rounded-md border p-3 text-xs space-y-1 ${
                          v.ok
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-amber-500/30 bg-amber-500/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          {v.ok ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                          )}
                          <span>Resumo de validação</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                          {v.skill_name && (
                            <span>
                              Skill:{" "}
                              <span className="text-foreground">
                                {v.skill_name}
                              </span>
                            </span>
                          )}
                          {typeof v.files_count === "number" && (
                            <span>
                              Arquivos:{" "}
                              <span className="text-foreground">
                                {v.files_count}
                              </span>
                            </span>
                          )}
                          {typeof v.total_bytes === "number" && (
                            <span>
                              Tamanho:{" "}
                              <span className="text-foreground">
                                {(v.total_bytes / 1024).toFixed(1)} KB
                              </span>
                            </span>
                          )}
                          <span>
                            SKILL.md:{" "}
                            <span className="text-foreground">
                              {v.has_skill_md ? "sim" : "não"}
                            </span>
                          </span>
                          <span>
                            .git/:{" "}
                            <span
                              className={
                                v.has_git ? "text-rose-400" : "text-foreground"
                              }
                            >
                              {v.has_git ? "presente (bloqueado)" : "ausente"}
                            </span>
                          </span>
                        </div>
                        {v.description && (
                          <p className="italic text-muted-foreground pt-1">
                            "{v.description}"
                          </p>
                        )}
                        {v.errors && v.errors.length > 0 && (
                          <ul className="list-disc list-inside text-rose-400 pt-1">
                            {v.errors.map((er, i) => (
                              <li key={i}>{er}</li>
                            ))}
                          </ul>
                        )}
                        {v.warnings && v.warnings.length > 0 && (
                          <ul className="list-disc list-inside text-amber-400">
                            {v.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Logs collapsible */}
                    {it.logs.length > 0 && (
                      <div className="rounded-md border border-border bg-muted/20">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenLogs((p) => ({ ...p, [it.id]: !logsOpen }))
                          }
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/40"
                        >
                          {logsOpen ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          Logs por etapa ({it.logs.length})
                        </button>
                        {logsOpen && (
                          <ol className="px-3 py-2 space-y-1 border-t border-border max-h-64 overflow-y-auto">
                            {it.logs.map((log, i) => (
                              <li
                                key={i}
                                className="text-xs font-mono flex gap-2"
                              >
                                <span className="text-muted-foreground shrink-0">
                                  {log.at
                                    ? new Date(log.at).toLocaleTimeString(
                                        "pt-BR"
                                      )
                                    : "--:--:--"}
                                </span>
                                {log.step && (
                                  <span className="text-primary shrink-0">
                                    [{log.step}]
                                  </span>
                                )}
                                <span
                                  className={
                                    log.level === "error"
                                      ? "text-rose-400"
                                      : log.level === "warn"
                                      ? "text-amber-400"
                                      : "text-foreground"
                                  }
                                >
                                  {log.message}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}

                    {it.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        {it.notes}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap pt-1">
                      {it.status === "pending" && !it.cancel_requested && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => requestStop(it.id)}
                          className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                        >
                          <StopCircle className="w-4 h-4 mr-1.5" />
                          Interromper registro
                        </Button>
                      )}
                      {it.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retry(it.id)}
                        >
                          <RotateCw className="w-4 h-4 mr-1.5" />
                          Tentar novamente
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card className="p-4 text-xs text-muted-foreground bg-muted/30">
          <strong className="text-foreground">Fluxo:</strong> upload XHR com
          progresso real → cancelável a qualquer momento. Após inserir,{" "}
          <code>cancel_requested</code> avisa o agente para abortar o registro
          em andamento. Falhas exibem botão de retentativa que reenfileira o
          mesmo ZIP no Storage sem reupload.
        </Card>
      </div>
    </div>
  );
}
