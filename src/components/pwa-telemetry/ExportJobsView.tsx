import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download, RefreshCw, AlertCircle, FileJson, FileSpreadsheet, Clock,
  CheckCircle2, XCircle, Loader2, ShieldAlert, LogIn, FileDown, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
  filters: Record<string, unknown> | null;
  format: 'csv' | 'json';
  progress: number;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

type PermissionError = {
  kind: "permission" | "auth" | "network";
  message: string;
  hint: string;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendente" },
  { value: "processing", label: "Processando" },
  { value: "completed", label: "Concluído" },
  { value: "failed", label: "Falhou" },
  { value: "cancelled", label: "Cancelado" },
];

const RETRY_DELAY_SECONDS = 10;

export const ExportJobsView = () => {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState<PermissionError | null>(null);
  const [reloading, setReloading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const retryTimer = useRef<number | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimer.current) {
      window.clearInterval(retryTimer.current);
      retryTimer.current = null;
    }
    setRetryIn(null);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setPermError({
          kind: "auth",
          message: "Sua sessão expirou ou você não está autenticado.",
          hint: "Faça login novamente para ver seus jobs de exportação.",
        });
        setJobs([]);
        return;
      }

      const { data, error } = await supabase
        .from("pwa_telemetry_export_jobs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        const code = (error as { code?: string }).code;
        const msg = error.message || "";
        if (code === "42501" || /permission denied/i.test(msg) || /row-level security/i.test(msg)) {
          setPermError({
            kind: "permission",
            message: "Você não tem permissão para visualizar os jobs de exportação.",
            hint: "Esta página requer a role admin, analyst ou viewer. Se sua role foi alterada recentemente, recarregue a sessão para aplicar as mudanças.",
          });
          setJobs([]);
          return;
        }
        throw error;
      }

      setPermError(null);
      clearRetryTimer();
      setJobs((data ?? []) as unknown as ExportJob[]);

      void supabase.from("pwa_telemetry_audit_logs" as never).insert({
        actor_id: sess.session.user.id,
        action_type: "view_jobs",
        filters: { count: data?.length ?? 0, source: "ExportJobsView" },
        deleted_count: 0,
      } as never);
    } catch (e) {
      setPermError({
        kind: "network",
        message: "Não foi possível carregar os jobs.",
        hint: (e as Error).message || "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }, [clearRetryTimer]);

  // Initial + light polling
  useEffect(() => {
    fetchJobs();
    const interval = window.setInterval(fetchJobs, 5000);
    return () => window.clearInterval(interval);
  }, [fetchJobs]);

  // Auto-retry countdown when permission/network error
  useEffect(() => {
    if (!permError || permError.kind === "auth") {
      clearRetryTimer();
      return;
    }
    setRetryIn(RETRY_DELAY_SECONDS);
    retryTimer.current = window.setInterval(() => {
      setRetryIn((s) => {
        if (s == null) return null;
        if (s <= 1) {
          clearRetryTimer();
          fetchJobs();
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearRetryTimer();
  }, [permError, fetchJobs, clearRetryTimer]);

  const handleReloadSession = async () => {
    setReloading(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
      toast.success("Sessão recarregada. Tentando novamente...");
      await fetchJobs();
    } catch (e) {
      toast.error(`Falha ao recarregar sessão: ${(e as Error).message}. Tente fazer login novamente.`);
    } finally {
      setReloading(false);
    }
  };

  const getStatusBadge = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 gap-1"><CheckCircle2 className="w-3 h-3" /> Concluído</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processando</Badge>;
      case 'pending':
        return <Badge variant="outline" className="gap-1 text-muted-foreground"><Clock className="w-3 h-3" /> Pendente</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Falhou</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="w-3 h-3" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFilterSummary = (filters: ExportJob['filters']) => {
    if (!filters || Object.keys(filters).length === 0) return "Sem filtros";
    return Object.entries(filters)
      .filter(([_, v]) => v !== null && v !== "" && v !== "all")
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
  };

  const filteredJobs = statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter);

  const handleExportList = () => {
    const headers = ["id", "status", "format", "progress", "created_at", "updated_at", "error_message", "filters", "result_url"];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filteredJobs.map((j) =>
      headers.map((h) => {
        if (h === "filters") return escape(JSON.stringify(j.filters ?? {}));
        return escape((j as unknown as Record<string, unknown>)[h]);
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-jobs-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredJobs.length} job(s) exportado(s) como CSV`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Jobs de Exportação</CardTitle>
          <CardDescription>Acompanhe o status das exportações em segundo plano.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[160px]" aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={handleExportList}
            disabled={filteredJobs.length === 0}
          >
            <FileDown className="w-3 h-3" /> Exportar lista
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchJobs} disabled={loading} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {permError ? (
          <Alert variant={permError.kind === "permission" ? "destructive" : "default"} role="alert">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>
              {permError.kind === "permission" && "Acesso negado"}
              {permError.kind === "auth" && "Sessão expirada"}
              {permError.kind === "network" && "Erro ao carregar"}
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{permError.message}</p>
              <p className="text-xs opacity-90">{permError.hint}</p>
              {retryIn !== null && (
                <p className="text-xs font-medium" aria-live="polite">
                  Nova tentativa automática em <span className="font-mono">{retryIn}s</span>…
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={handleReloadSession} disabled={reloading} className="gap-2">
                  <RefreshCw className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
                  Recarregar sessão
                </Button>
                <Button size="sm" variant="outline" onClick={() => { clearRetryTimer(); fetchJobs(); }} className="gap-2">
                  Tentar agora
                </Button>
                {retryIn !== null && (
                  <Button size="sm" variant="ghost" onClick={clearRetryTimer}>
                    Cancelar nova tentativa
                  </Button>
                )}
                {permError.kind === "auth" && (
                  <Button size="sm" variant="default" onClick={() => { window.location.href = "/auth"; }} className="gap-2">
                    <LogIn className="w-3 h-3" /> Ir para login
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {loading ? "Carregando jobs…" : statusFilter === "all"
              ? "Nenhum job de exportação encontrado."
              : `Nenhum job com status "${STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}".`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Filtros</TableHead>
                  <TableHead>Status / Progresso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(job.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {job.format === 'csv' ? <FileSpreadsheet className="w-4 h-4 text-green-600" /> : <FileJson className="w-4 h-4 text-blue-600" />}
                        <span className="uppercase text-xs font-bold">{job.format}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={getFilterSummary(job.filters)}>
                      {getFilterSummary(job.filters)}
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          {getStatusBadge(job.status)}
                          {(job.status === 'processing' || job.status === 'pending') && (
                            <span className="text-[10px] font-medium">{job.progress}%</span>
                          )}
                        </div>
                        {(job.status === 'processing' || job.status === 'pending') && (
                          <Progress value={job.progress} className="h-1" />
                        )}
                        {job.status === 'failed' && job.error_message && (
                          <p className="text-[10px] text-destructive truncate max-w-[150px]" title={job.error_message}>
                            {job.error_message}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" asChild className="h-8 gap-1" title="Ver detalhes">
                          <Link to={`/pwa/telemetry/jobs/${job.id}`}>
                            <ExternalLink className="w-3 h-3" /> Detalhes
                          </Link>
                        </Button>
                        {job.status === 'completed' && job.result_url && (
                          <Button variant="outline" size="sm" asChild className="h-8 gap-2">
                            <a href={job.result_url} download={`telemetry-${job.id}.${job.format}`} target="_blank" rel="noreferrer">
                              <Download className="w-3 h-3" /> Baixar
                            </a>
                          </Button>
                        )}
                        {job.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2"
                            onClick={async () => {
                              try {
                                const { error } = await supabase.functions.invoke("pwa-telemetry", {
                                  body: { action: "retry", jobId: job.id },
                                });
                                if (error) throw error;
                                toast.success("Job reenviado para processamento");
                                fetchJobs();
                              } catch (e) {
                                toast.error(`Falha ao reexecutar: ${(e as Error).message}`);
                              }
                            }}
                          >
                            <RefreshCw className="w-3 h-3" /> Reexecutar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
