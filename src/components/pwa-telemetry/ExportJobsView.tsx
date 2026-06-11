import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw, AlertCircle, FileJson, FileSpreadsheet, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
  filters: any;
  format: 'csv' | 'json';
  progress: number;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const ExportJobsView = () => {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("pwa_telemetry_export_jobs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setJobs((data as any) || []);
    } catch (e: any) {
      toast.error(`Erro ao carregar jobs: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

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

  const getFilterSummary = (filters: any) => {
    if (!filters || Object.keys(filters).length === 0) return "Sem filtros";
    return Object.entries(filters)
      .filter(([_, v]) => v !== null && v !== "" && v !== "all")
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Jobs de Exportação</CardTitle>
          <CardDescription>Acompanhe o status das exportações em segundo plano.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchJobs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            Nenhum job de exportação encontrado.
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
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
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
                      <div className="flex gap-2">
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
                              } catch (e: any) {
                                toast.error(`Falha ao reexecutar: ${e.message}`);
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
