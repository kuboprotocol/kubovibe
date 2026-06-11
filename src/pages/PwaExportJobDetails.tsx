import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft, Download, RefreshCw, XCircle, CheckCircle2, Loader2, Clock,
  AlertCircle, ShieldAlert, FileJson, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

interface ExportJob {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "completed" | "cancelled" | "failed";
  filters: Record<string, unknown> | null;
  format: "csv" | "json";
  progress: number;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<ExportJob["status"], { label: string; cls: string; icon: React.ReactNode }> = {
  completed: { label: "Concluído", cls: "bg-green-500/10 text-green-500 border-green-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  processing: { label: "Processando", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  pending: { label: "Pendente", cls: "text-muted-foreground", icon: <Clock className="w-3 h-3" /> },
  failed: { label: "Falhou", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground", icon: <AlertCircle className="w-3 h-3" /> },
};

export default function PwaExportJobDetails() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data, error } = await supabase
        .from("pwa_telemetry_export_jobs" as never)
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError("Job não encontrado ou você não tem permissão para visualizá-lo.");
        setJob(null);
      } else {
        setJob(data as unknown as ExportJob);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
    const id = setInterval(fetchJob, 4000);
    return () => clearInterval(id);
  }, [fetchJob]);

  const handleRetry = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("pwa-telemetry", {
        body: { action: "retry", jobId: job.id },
      });
      if (error) throw error;
      toast.success("Job reenviado para processamento");
      navigate("/pwa/telemetry");
    } catch (e) {
      toast.error(`Falha ao reexecutar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("pwa-telemetry", {
        body: { action: "cancel", jobId: job.id },
      });
      if (error) throw error;
      toast.success("Cancelamento solicitado");
      await fetchJob();
    } catch (e) {
      toast.error(`Falha ao cancelar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/pwa/telemetry" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para Telemetry
        </Link>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando job…</div>
        ) : error ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Não foi possível abrir o job</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : job ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {job.format === "csv"
                      ? <FileSpreadsheet className="w-5 h-5 text-green-600" />
                      : <FileJson className="w-5 h-5 text-blue-600" />}
                    Job {job.id.slice(0, 8)}…
                  </CardTitle>
                  <CardDescription>
                    Criado em {new Date(job.created_at).toLocaleString()} · Atualizado em {new Date(job.updated_at).toLocaleString()}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={`gap-1 ${STATUS_STYLES[job.status].cls}`}>
                  {STATUS_STYLES[job.status].icon} {STATUS_STYLES[job.status].label}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                {(job.status === "processing" || job.status === "pending") && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progresso</span><span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} />
                  </div>
                )}

                {job.status === "failed" && job.error_message && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription className="break-words text-xs">{job.error_message}</AlertDescription>
                  </Alert>
                )}

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <Info label="Formato" value={job.format.toUpperCase()} />
                  <Info label="Status" value={STATUS_STYLES[job.status].label} />
                  <Info label="Owner" value={job.user_id} mono />
                  <Info label="Job ID" value={job.id} mono />
                </div>

                <div>
                  <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Filtros aplicados</div>
                  <pre className="bg-muted/40 rounded-lg p-4 text-xs overflow-auto max-h-80">
                    {JSON.stringify(job.filters ?? {}, null, 2)}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {job.status === "completed" && job.result_url && (
                    <Button asChild className="gap-2">
                      <a href={job.result_url} download={`telemetry-${job.id}.${job.format}`} target="_blank" rel="noreferrer">
                        <Download className="w-4 h-4" /> Baixar arquivo
                      </a>
                    </Button>
                  )}
                  {job.status === "failed" && (
                    <Button onClick={handleRetry} disabled={busy} className="gap-2">
                      <RefreshCw className="w-4 h-4" /> Reexecutar
                    </Button>
                  )}
                  {(job.status === "processing" || job.status === "pending") && (
                    <Button variant="destructive" onClick={handleCancel} disabled={busy} className="gap-2">
                      <XCircle className="w-4 h-4" /> Cancelar
                    </Button>
                  )}
                  <Button variant="outline" onClick={fetchJob} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
