import { useState } from "react";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, Hash, Activity, Terminal, Shield, 
  Download, Play, Pause, XCircle, History,
  FileJson, FileSpreadsheet, AlertCircle, Info,
  Search, ChevronLeft, ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AuditLog {
  id: string;
  action: string;
  created_at: string;
  details: any;
  correlation_id?: string;
}

interface JobDetailsSheetProps {
  job: any | null;
  auditLogs: AuditLog[];
  onClose: () => void;
  onAction: (action: "cancel" | "pause" | "resume" | "retry") => Promise<void>;
  loading?: boolean;
}

export function JobDetailsSheet({ job, auditLogs, onClose, onAction, loading }: JobDetailsSheetProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmAction, setConfirmAction] = useState<"cancel" | "pause" | "resume" | "retry" | null>(null);
  const [timelineSearch, setTimelineSearch] = useState("");
  
  // Export pagination
  const [exportLimit, setExportLimit] = useState(100);
  const [exportOffset, setExportOffset] = useState(0);

  if (!job) return null;

  const exportJSON = () => {
    const pagedLogs = auditLogs.slice(exportOffset, Math.min(exportOffset + exportLimit, auditLogs.length));
    const data = {
      job: {
        id: job.id,
        agent: job.agent_slug,
        status: job.status,
        correlation_id: job.correlation_id,
        created_at: job.created_at
      },
      audit_logs: pagedLogs,
      export_metadata: {
        limit: exportLimit,
        offset: exportOffset,
        total_records: auditLogs.length,
        exported_at: new Date().toISOString()
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${job.id}-p${Math.floor(exportOffset/exportLimit)+1}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ["ID", "Action", "Correlation ID", "Created At", "Details"];
    const pagedLogs = auditLogs.slice(exportOffset, Math.min(exportOffset + exportLimit, auditLogs.length));
    const rows = pagedLogs.map(log => [
      log.id,
      log.action,
      log.correlation_id || "",
      new Date(log.created_at).toISOString(),
      JSON.stringify(log.details).replace(/"/g, '""')
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-audit-${job.id}-p${Math.floor(exportOffset/exportLimit)+1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const getExportPreview = (format: 'json' | 'csv') => {
    const pagedLogs = auditLogs.slice(exportOffset, exportOffset + exportLimit);
    return {
      totalEntries: auditLogs.length,
      pagedEntries: pagedLogs.length,
      format,
      estimatedSize: format === 'json' ? `${(JSON.stringify(pagedLogs).length / 1024).toFixed(1)} KB` : `${(pagedLogs.length * 100 / 1024).toFixed(1)} KB`
    };
  };

  const filteredLogs = auditLogs.filter(log => 
    !timelineSearch || 
    log.action.toLowerCase().includes(timelineSearch.toLowerCase()) ||
    (log.correlation_id && log.correlation_id.toLowerCase().includes(timelineSearch.toLowerCase())) ||
    (log.details && JSON.stringify(log.details).toLowerCase().includes(timelineSearch.toLowerCase()))
  );

  const handleConfirmedAction = async () => {
    if (confirmAction) {
      await onAction(confirmAction);
      setConfirmAction(null);
    }
  };

  return (
    <>
      <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-2xl flex flex-col h-full">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Detalhes do Job
              </SheetTitle>
              <Badge variant={job.status === "completed" || job.status === "succeeded" ? "secondary" : "outline"} className="capitalize">
                {job.status}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <SheetDescription className="font-mono text-[10px] break-all flex items-center gap-2">
                ID: {job.id}
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => navigator.clipboard.writeText(job.id)}>
                   <Hash className="h-2 w-2" />
                </Button>
              </SheetDescription>
              <SheetDescription className="font-mono text-[10px] text-primary flex items-center gap-1">
                <Shield className="h-3 w-3" /> TraceID: {job.correlation_id || "N/A"}
                {job.correlation_id && (
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => navigator.clipboard.writeText(job.correlation_id)}>
                    <Info className="h-2 w-2" />
                  </Button>
                )}
              </SheetDescription>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="data">E/S Dados</TabsTrigger>
              <TabsTrigger value="timeline">Timeline & Retries</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-hidden pt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Agente</p>
                      <p className="font-medium text-sm">{job.agent_slug}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Idempotency Key</p>
                      <p className="font-mono text-[10px] truncate" title={job.idempotency_key}>
                        {job.idempotency_key || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Status do Runtime</p>
                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{job.status}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Tentativas Totais</p>
                      <p className="text-sm">{job.retry_count || 0} de 5</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Timestamps
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Criado em</p>
                        <p>{new Date(job.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Concluído em</p>
                        <p>{job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duração Total</p>
                        <p>{job.duration_ms || job.execution_time_ms ? `${job.duration_ms || job.execution_time_ms}ms` : "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Próximo Agendamento</p>
                        <p>{job.next_retry_at ? new Date(job.next_retry_at).toLocaleString() : "Nenhum"}</p>
                      </div>
                    </div>
                  </div>

                  {job.error_message && (
                    <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                      <div className="flex items-center gap-2 text-destructive mb-1">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-xs font-semibold">Último Erro</p>
                      </div>
                      <p className="text-xs font-mono break-all">{job.error_message}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="data" className="flex-1 overflow-hidden pt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <Terminal className="h-3 w-3" /> Input Payload
                    </h4>
                    <pre className="p-3 rounded bg-muted text-[10px] font-mono overflow-auto max-h-48 border">
                      {JSON.stringify(job.input, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <Activity className="h-3 w-3" /> Output / Result
                    </h4>
                    <pre className="p-3 rounded bg-muted text-[10px] font-mono overflow-auto max-h-48 border">
                      {JSON.stringify(job.output || job.result, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="timeline" className="flex-1 overflow-hidden pt-4">
              <div className="mb-4 relative">
                <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input 
                  placeholder="Filtrar eventos ou TraceID..." 
                  className="pl-7 h-8 text-xs" 
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[calc(100%-3rem)] pr-4">
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-2 before:w-px before:bg-border">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => {
                      const isAttempt = log.action.includes('attempt');
                      const isError = log.action.includes('failed') || log.action.includes('error');
                      const isSuccess = log.action.includes('success') || log.action.includes('succeeded');
                      
                      return (
                        <div key={log.id} className="relative pl-7 pb-4">
                          <div className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-background border-2 z-10 ${
                            isError ? 'border-destructive' : isSuccess ? 'border-emerald-500' : 'border-primary'
                          }`} />
                          <div className="flex flex-col bg-muted/30 p-2 rounded-md border border-transparent hover:border-border transition-colors">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold uppercase tracking-tight ${
                                isError ? 'text-destructive' : isSuccess ? 'text-emerald-500' : 'text-foreground'
                              }`}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            {log.details && (
                              <div className="mt-2 space-y-1">
                                {log.details.attempt && (
                                  <p className="text-[10px] font-mono">
                                    <span className="text-muted-foreground">Tentativa:</span> {log.details.attempt}
                                    {log.details.max_retries && ` de ${log.details.max_retries}`}
                                    {log.details.backoff_ms > 0 && ` (Backoff: ${log.details.backoff_ms}ms)`}
                                  </p>
                                )}
                                {log.details.error && (
                                  <p className="text-[10px] text-destructive font-mono bg-destructive/5 p-1 rounded">
                                    {log.details.error}
                                  </p>
                                )}
                                {typeof log.details === 'string' ? (
                                  <p className="text-xs text-muted-foreground">{log.details}</p>
                                ) : (
                                  Object.keys(log.details).filter(k => !['attempt', 'error', 'timestamp', 'max_retries', 'backoff_ms'].includes(k)).length > 0 && (
                                    <pre className="text-[10px] text-muted-foreground bg-muted p-1 rounded overflow-auto">
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Nenhum evento registrado ainda.</p>
                      <p className="text-xs opacity-50">Eventos do orquestrador e agentes aparecerão aqui.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="pt-6 border-t mt-auto">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Exportar Paginado</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>{getExportPreview('json').pagedEntries} de {auditLogs.length} entradas</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                   <div className="flex-1 flex items-center gap-1 bg-muted rounded p-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={exportOffset <= 0} onClick={() => setExportOffset(Math.max(0, exportOffset - exportLimit))}>
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <div className="flex-1 text-center">
                        <span className="text-[10px] font-mono block">Pág {Math.floor(exportOffset/exportLimit)+1}</span>
                        <span className="text-[9px] text-muted-foreground">Offset: {exportOffset}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={exportOffset + exportLimit >= auditLogs.length} onClick={() => setExportOffset(exportOffset + exportLimit)}>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                   </div>
                   <div className="w-24 space-y-1">
                      <p className="text-[9px] text-muted-foreground px-1">Registros/pág</p>
                      <Input 
                        type="number" 
                        value={exportLimit} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 10;
                          setExportLimit(val);
                          setExportOffset(0); // Reset offset on limit change
                        }}
                        className="h-8 text-[10px]"
                        placeholder="Limite"
                      />
                   </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={exportJSON}>
                    <FileJson className="h-3 w-3 mr-1" /> JSON ({getExportPreview('json').estimatedSize})
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={exportCSV}>
                    <FileSpreadsheet className="h-3 w-3 mr-1" /> CSV ({getExportPreview('csv').estimatedSize})
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                {['failed', 'succeeded', 'completed', 'refunded'].includes(job.status) && (
                  <Button size="sm" onClick={() => setConfirmAction("retry")} disabled={loading}>
                    <Play className="h-4 w-4 mr-2" /> Reexecutar
                  </Button>
                )}
                {['processing', 'running', 'queued'].includes(job.status) && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmAction("pause")} disabled={loading}>
                      <Pause className="h-4 w-4 mr-2" /> Pausar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setConfirmAction("cancel")} disabled={loading}>
                      <XCircle className="h-4 w-4 mr-2" /> Cancelar
                    </Button>
                  </>
                )}
                {job.status === "paused" && (
                  <Button size="sm" onClick={() => setConfirmAction("resume")} disabled={loading}>
                    <Play className="h-4 w-4 mr-2" /> Retomar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja {
                confirmAction === "cancel" ? "cancelar este job? Isso interromperá o processamento atual." :
                confirmAction === "pause" ? "pausar este job?" :
                confirmAction === "resume" ? "retomar o processamento deste job?" :
                "reexecutar este job? Uma nova tentativa será iniciada respeitando a idempotência."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleConfirmedAction();
              }}
              disabled={loading}
              className={confirmAction === "cancel" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {loading ? "Processando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
