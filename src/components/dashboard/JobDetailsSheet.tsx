import { useState } from "react";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, Hash, Activity, Terminal, Shield, 
  Download, Play, Pause, XCircle, History
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface AuditLog {
  id: string;
  action: string;
  created_at: string;
  details: any;
  actor_id?: string;
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

  if (!job) return null;

  const exportLogs = () => {
    const data = {
      job,
      audit_logs: auditLogs
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-details-${job.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl flex flex-col h-full">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              Detalhes do Job
            </SheetTitle>
            <Badge variant={job.status === "completed" ? "secondary" : "outline"} className="capitalize">
              {job.status}
            </Badge>
          </div>
          <SheetDescription className="font-mono text-[10px] break-all">
            ID: {job.id}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="data">E/S Dados</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
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
                    <p className="text-xs text-muted-foreground">Correlation ID</p>
                    <p className="font-mono text-xs">{job.correlation_id || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Tentativas</p>
                    <p className="text-sm">{job.retry_count || 0} de 5</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Idempotency Key</p>
                    <p className="font-mono text-[10px] truncate" title={job.idempotency_key}>
                      {job.idempotency_key || "N/A"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Tempos de Execução
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
                      <p className="text-muted-foreground">Próximo Retry</p>
                      <p>{job.next_retry_at ? new Date(job.next_retry_at).toLocaleString() : "Nenhum"}</p>
                    </div>
                  </div>
                </div>

                {job.error_message && (
                  <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                    <p className="text-xs font-semibold text-destructive mb-1">Último Erro:</p>
                    <p className="text-xs font-mono">{job.error_message}</p>
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
                  <pre className="p-3 rounded bg-muted text-[10px] font-mono overflow-auto max-h-48">
                    {JSON.stringify(job.input, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Output / Result
                  </h4>
                  <pre className="p-3 rounded bg-muted text-[10px] font-mono overflow-auto max-h-48">
                    {JSON.stringify(job.output || job.result, null, 2)}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 overflow-hidden pt-4">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-2 before:w-px before:bg-border">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <div key={log.id} className="relative pl-6 pb-2">
                      <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold capitalize">{log.action.replace('_', ' ')}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Nenhum evento registrado ainda.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="pt-6 border-t mt-auto">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" /> Exportar JSON
            </Button>
            
            <div className="flex gap-2">
              {job.status === "failed" && (
                <Button size="sm" onClick={() => onAction("retry")} disabled={loading}>
                  <Play className="h-4 w-4 mr-2" /> Reexecutar
                </Button>
              )}
              {job.status === "processing" && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => onAction("pause")} disabled={loading}>
                    <Pause className="h-4 w-4 mr-2" /> Pausar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onAction("cancel")} disabled={loading}>
                    <XCircle className="h-4 w-4 mr-2" /> Cancelar
                  </Button>
                </>
              )}
              {job.paused_at && (
                <Button size="sm" onClick={() => onAction("resume")} disabled={loading}>
                  <Play className="h-4 w-4 mr-2" /> Retomar
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
