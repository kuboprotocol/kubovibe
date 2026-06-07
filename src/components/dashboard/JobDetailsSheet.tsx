import { useState, useEffect, useRef, useMemo } from "react";
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
  Search, ChevronLeft, ChevronRight, RefreshCw,
  BarChart3, FileText, Copy, Check, Calendar, Globe
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  connectionStatus?: "connecting" | "live" | "polling";
  onReconnect?: () => void;
  nextPollIn?: number;
  pollingRetryCount?: number;
  websocketError?: string | null;
}


export function JobDetailsSheet({ 
  job, 
  auditLogs, 
  onClose, 
  onAction, 
  loading,
  connectionStatus = "live",
  onReconnect,
  nextPollIn,
   pollingRetryCount,
   websocketError
}: JobDetailsSheetProps) {

  const [activeTab, setActiveTab] = useState("overview");
  const [confirmAction, setConfirmAction] = useState<"cancel" | "pause" | "resume" | "retry" | null>(null);
  const [timelineSearch, setTimelineSearch] = useState("");
  const timelineRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Export states
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [exportLimit, setExportLimit] = useState(100);
  const [exportOffset, setExportOffset] = useState(0);
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("UTC");

  const timeZones = [
    { label: "UTC", value: "UTC" },
    { label: "Brasília (BRT)", value: "America/Sao_Paulo" },
    { label: "New York (EST)", value: "America/New_York" },
    { label: "London (GMT)", value: "Europe/London" },
  ];

  const formatWithTZ = (date: string | Date, formatStr: string = "yyyy-MM-dd HH:mm:ss") => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date(date));
  };

  const validateDateRange = () => {
    setDateError(null);
    const now = new Date();
    
    if (dateRange.from && dateRange.to && dateRange.from > dateRange.to) {
      setDateError("A data inicial não pode ser maior que a final.");
      return false;
    }
    
    if ((dateRange.from && dateRange.from > now) || (dateRange.to && dateRange.to > now)) {
      setDateError("Datas futuras não são permitidas.");
      return false;
    }
    
    return true;
  };

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
    toast({ title: "Exportação JSON concluída" });
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
    toast({ title: "Exportação CSV concluída" });
  };

  const exportAlertsCSV = () => {
    if (!validateDateRange()) return;

    // Collect specific alerts info with date filter
    const alertLogs = auditLogs.filter(log => {
      const isAlert = log.action.includes('error') || 
                      log.action.includes('failed') || 
                      (log.details && log.details.latency_p95 > 0);
      
      if (!isAlert) return false;
      
      if (dateRange.from || dateRange.to) {
        const logDate = new Date(log.created_at);
        if (dateRange.from && logDate < dateRange.from) return false;
        if (dateRange.to && logDate > dateRange.to) return false;
      }
      
      return true;
    });

    if (alertLogs.length === 0) {
      toast({ 
        title: "Nenhum alerta encontrado", 
        description: "Não há dados para exportar no período selecionado.",
        variant: "destructive"
      });
      return;
    }

    const headers = ["ID", "Action", "TraceID", "CorrelationID", "Latency p95", "Retries", "Created At", "TimeZone"];
    const rows = alertLogs.map(log => [
      log.id,
      log.action,
      job.id,
      log.correlation_id || job.correlation_id || "",
      log.details?.latency_p95 || "",
      log.details?.attempt || "",
      formatWithTZ(log.created_at),
      timeZone
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const timestamp = new Date().getTime();
    const fileName = `alerts-audit-${job.correlation_id || job.id}-${timestamp}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório de Alertas CSV concluído", description: `Arquivo: ${fileName}` });
  };

  const exportAlertsPDF = () => {
    if (!validateDateRange()) return;

    const alertLogs = auditLogs.filter(log => {
      const isAlert = log.action.includes('error') || 
                      log.action.includes('failed') || 
                      (log.details && log.details.latency_p95 > 0);
      
      if (!isAlert) return false;
      
      if (dateRange.from || dateRange.to) {
        const logDate = new Date(log.created_at);
        if (dateRange.from && logDate < dateRange.from) return false;
        if (dateRange.to && logDate > dateRange.to) return false;
      }
      
      return true;
    });

    const doc = new jsPDF();
    const timestamp = new Date().getTime();
    const fileName = `audit-${job.correlation_id || job.id}-${timestamp}.pdf`;

    doc.setFontSize(18);
    doc.text("Relatório de Auditoria de Alertas", 14, 22);
    
    if (alertLogs.length > 0) {
      // Summary Section
      doc.setFontSize(12);
      doc.text("Resumo Agregado (CorrelationID)", 14, 32);
      
      const aggregation = alertLogs.reduce((acc: any, log) => {
        const cid = log.correlation_id || job.correlation_id || "N/A";
        if (!acc[cid]) {
          acc[cid] = { count: 0, maxP95: 0, totalRetries: 0 };
        }
        acc[cid].count += 1;
        const p95 = log.details?.latency_p95 || 0;
        if (p95 > acc[cid].maxP95) acc[cid].maxP95 = p95;
        acc[cid].totalRetries += (log.details?.attempt || 0);
        return acc;
      }, {});

      const summaryRows = Object.entries(aggregation).map(([cid, data]: [string, any]) => [
        cid,
        data.count,
        `${data.maxP95}ms`,
        data.totalRetries
      ]);

      autoTable(doc, {
        startY: 35,
        head: [["CorrelationID", "Qtd Alertas", "Maior p95", "Total Retries"]],
        body: summaryRows,
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;

      doc.setFontSize(12);
      doc.text("Detalhes dos Alertas", 14, finalY);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`TraceID: ${job.id}`, 14, finalY + 7);
      doc.text(`Filtro Período: ${dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "Início"} - ${dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "Fim"} (${timeZone})`, 14, finalY + 12);

      const tableRows = alertLogs.map(log => [
        log.action,
        log.correlation_id || job.correlation_id || "N/A",
        log.details?.latency_p95 ? `${log.details.latency_p95}ms` : "N/A",
        log.details?.attempt || "N/A",
        formatWithTZ(log.created_at)
      ]);

      autoTable(doc, {
        startY: finalY + 15,
        head: [["Ação", "CorrelationID", "p95", "Retries", "Data/Hora"]],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });
    } else {
      doc.setFontSize(12);
      doc.setTextColor(150);
      doc.text("Nenhum alerta encontrado para o período selecionado.", 14, 40);
      doc.setFontSize(10);
      doc.text("Tente expandir o intervalo de datas ou verificar outro TraceID.", 14, 50);
      
      doc.setTextColor(100);
      doc.text(`TraceID consultado: ${job.id}`, 14, 70);
      doc.text(`Período: ${dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "Início"} - ${dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "Fim"} (${timeZone})`, 14, 75);
    }

    doc.save(fileName);
    toast({ title: "Relatório de Alertas PDF concluído", description: `Arquivo: ${fileName}` });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado!`,
      description: "Valor salvo na área de transferência.",
    });
  };
  
  
  const getExportPreview = () => {
    const pagedLogs = auditLogs.slice(exportOffset, exportOffset + exportLimit);
    const counts = pagedLogs.reduce((acc: any, log) => {
      const type = log.action.includes('error') || log.action.includes('failed') ? 'erro' : 
                   log.action.includes('event') ? 'evento' : 'entrada';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalEntries: auditLogs.length,
      pagedEntries: pagedLogs.length,
      estimatedSizeJSON: `${(JSON.stringify(pagedLogs).length / 1024).toFixed(1)} KB`,
      estimatedSizeCSV: `${(pagedLogs.length * 150 / 1024).toFixed(1)} KB`,
      counts
    };
  };

  const preview = getExportPreview();

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

  const clearFilters = () => {
    setTimelineSearch("");
  };

  useEffect(() => {
    if (activeTab === "timeline" && timelineSearch) {
      const match = filteredLogs.find(log => 
        log.correlation_id === timelineSearch || 
        log.id === timelineSearch ||
        (log.details && JSON.stringify(log.details).includes(timelineSearch))
      );
      
      if (match && timelineRefs.current[match.id]) {
        timelineRefs.current[match.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeTab, timelineSearch, filteredLogs.length]);

  const hasEventsForCorrelation = (corrId: string) => {
    return auditLogs.some(log => log.correlation_id === corrId);
  };

  const isSearchingCorrelation = timelineSearch && timelineSearch.length > 10;

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
              <SheetDescription className="font-mono text-[10px] break-all flex items-center gap-2 group">
                ID: {job.id}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" 
                  onClick={() => copyToClipboard(job.id, "TraceID")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </SheetDescription>
              <SheetDescription className="font-mono text-[10px] text-primary flex flex-col gap-1">
                <span className="flex items-center gap-1 group">
                  <Shield className="h-3 w-3" /> TraceID: {job.id}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={() => copyToClipboard(job.id, "TraceID")}
                  >
                    <Copy className="h-2 w-2" />
                  </Button>
                </span>
                {job.correlation_id && (
                  <span className="flex items-center gap-1 text-emerald-600 group">
                    <Hash className="h-3 w-3" /> CorrelationID: {job.correlation_id}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => copyToClipboard(job.correlation_id, "CorrelationID")}
                    >
                      <Copy className="h-2 w-2" />
                    </Button>
                  </span>
                )}
              </SheetDescription>
            </div>
          </SheetHeader>

          {connectionStatus === "polling" && (
            <Alert className="mb-4 py-2 border-amber-200 bg-amber-50 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <RefreshCw className="h-4 w-4 text-amber-600 animate-spin" />
              <AlertTitle className="text-xs font-bold text-amber-800 flex items-center gap-2">
                Fallback para Polling Ativo
                <Badge variant="outline" className="h-4 px-1 text-[8px] border-amber-300 text-amber-700 bg-amber-100/50">
                  Tentativa #{pollingRetryCount || 1}
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-[10px] text-amber-700 mt-1">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span>Próxima atualização estimada em <strong>{nextPollIn || 0}s</strong></span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-auto p-0 text-[10px] text-amber-800 font-bold hover:text-amber-900 hover:bg-transparent underline" 
                      onClick={onReconnect}
                    >
                      Reconectar WebSocket
                    </Button>
                  </div>
                  {websocketError && (
                    <div className="bg-amber-100/50 p-1.5 rounded border border-amber-200/50 flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>Motivo da falha: <code className="text-[9px]">{websocketError}</code></span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}


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
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
                      <BarChart3 className="h-3 w-3" /> Performance Local
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-background p-1.5 rounded border border-border/50">
                        <span className="text-muted-foreground">Latência do Job:</span>
                        <span className="ml-1 font-mono font-bold text-primary">
                          {job.execution_time_ms || job.duration_ms ? `${job.execution_time_ms || job.duration_ms}ms` : "N/A"}
                        </span>
                      </div>
                      <div className="bg-background p-1.5 rounded border border-border/50">
                        <span className="text-muted-foreground">Overhead Orq:</span>
                        <span className="ml-1 font-mono font-bold text-emerald-600">~12ms</span>
                      </div>
                      <div className="bg-background p-1.5 rounded border border-border/50">
                        <span className="text-muted-foreground">Retries Polling:</span>
                        <span className="ml-1 font-mono font-bold text-amber-600">
                          {pollingRetryCount || 0}
                        </span>
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
                  placeholder="Filtrar eventos, TraceID ou CorrelationID..." 
                  className="pl-7 h-8 text-xs" 
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[calc(100%-3rem)] pr-4">
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-2 before:w-px before:bg-border min-h-[200px]">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => {
                      const isError = log.action.includes('failed') || log.action.includes('error');
                      const isSuccess = log.action.includes('success') || log.action.includes('succeeded');
                      
                      return (
                        <div 
                          key={log.id} 
                          ref={el => timelineRefs.current[log.id] = el}
                          className={`relative pl-7 pb-4 transition-all duration-500 ${
                            timelineSearch && (
                              log.correlation_id === timelineSearch || 
                              log.id === timelineSearch || 
                              (log.details && JSON.stringify(log.details).includes(timelineSearch))
                            ) ? 'scale-[1.02] bg-primary/10 rounded-r-md -ml-2 pl-9 ring-1 ring-primary/20 shadow-md' : ''
                          }`}
                        >
                          <div className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-background border-2 z-10 ${
                            isError ? 'border-destructive' : isSuccess ? 'border-emerald-500' : 'border-primary'
                          }`} />
                          <div className={`flex flex-col bg-muted/30 p-2 rounded-md border border-transparent hover:border-border transition-colors ${
                            timelineSearch && (
                              log.correlation_id === timelineSearch || 
                              log.id === timelineSearch
                            ) ? 'border-primary shadow-sm' : ''
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold uppercase tracking-tight ${
                                isError ? 'text-destructive' : isSuccess ? 'text-emerald-500' : 'text-foreground'
                              }`}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            {log.details && (
                              <div className="mt-1 space-y-1">
                                {log.details.attempt && (
                                  <p className="text-[9px] font-mono">
                                    <span className="text-muted-foreground">T:</span> {log.details.attempt}
                                    {log.details.backoff_ms > 0 && ` (Retry em ${log.details.backoff_ms}ms)`}
                                  </p>
                                )}
                                {log.details.error && (
                                  <p className="text-[9px] text-destructive font-mono bg-destructive/5 p-1 rounded">
                                    {log.details.error}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed mx-2">
                      <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">Nenhum evento encontrado</p>
                      {timelineSearch ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-[10px]">
                            {isSearchingCorrelation && !hasEventsForCorrelation(timelineSearch) 
                              ? `Não foram encontrados eventos específicos para o CorrelationID "${timelineSearch}" neste job.`
                              : `Não há eventos correspondentes a "${timelineSearch}"`}
                          </p>
                          <div className="flex justify-center gap-2">
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="h-auto p-0 text-[10px]" 
                              onClick={clearFilters}
                            >
                              Limpar filtro
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] mt-1">Aguardando processamento ou novos logs do job.</p>
                      )}
                      <div className="mt-4 pt-4 border-t border-dashed border-border/50">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2">Sugestões de Investigação:</p>
                        <ul className="text-[9px] text-left list-disc list-inside space-y-1 max-w-[240px] mx-auto">
                          <li>O CorrelationID pode estar em outro Job (verifique a busca global)</li>
                          <li>Certifique-se que o evento não foi filtrado por erro de rede</li>
                          <li>Tente reexecutar o job para gerar novos logs</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="pt-6 border-t mt-auto">
            <div className="bg-muted/50 p-3 rounded-lg border mb-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-semibold">Configuração de Exportação</span>
                <Badge variant="outline" className="text-[10px]">Página {Math.floor(exportOffset/exportLimit)+1}</Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-muted-foreground ml-1 flex items-center gap-1">
                    <Calendar className="h-2 w-2" /> Intervalo de Datas (Opcional)
                  </p>
                  {dateError && <p className="text-[9px] text-destructive font-bold animate-pulse">{dateError}</p>}
                </div>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 justify-start">
                        {dateRange.from ? format(dateRange.from, "dd/MM/yy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 justify-start">
                        {dateRange.to ? format(dateRange.to, "dd/MM/yy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {(dateRange.from || dateRange.to) && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={() => setDateRange({ from: undefined, to: undefined })}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background p-2 rounded border text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">Entradas</p>
                  <p className="text-sm font-bold">{preview.counts.entrada || 0}</p>
                </div>
                <div className="bg-background p-2 rounded border text-center">
                  <p className="text-[9px] text-muted-foreground uppercase text-amber-600">Eventos</p>
                  <p className="text-sm font-bold">{preview.counts.evento || 0}</p>
                </div>
                <div className="bg-background p-2 rounded border text-center">
                  <p className="text-[9px] text-muted-foreground uppercase text-destructive">Erros</p>
                  <p className="text-sm font-bold">{preview.counts.erro || 0}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                   <p className="text-[9px] text-muted-foreground ml-1">Offset: {exportOffset} (Total: {auditLogs.length})</p>
                   <div className="flex items-center gap-1 bg-background rounded border p-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={exportOffset <= 0} onClick={() => setExportOffset(Math.max(0, exportOffset - exportLimit))}>
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <div className="flex-1 text-[10px] text-center font-mono">Pág {Math.floor(exportOffset/exportLimit)+1}</div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={exportOffset + exportLimit >= auditLogs.length} onClick={() => setExportOffset(exportOffset + exportLimit)}>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                   </div>
                </div>
                <div className="w-24 space-y-1">
                   <p className="text-[9px] text-muted-foreground ml-1">Itens/pág</p>
                   <Input 
                      type="number" 
                      value={exportLimit} 
                      onChange={(e) => {
                        const val = Math.max(10, parseInt(e.target.value) || 10);
                        setExportLimit(val);
                        setExportOffset(0);
                      }}
                      className="h-7 text-[10px] bg-background"
                   />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-[10px] flex-1 bg-background" onClick={exportJSON}>
                  <FileJson className="h-3 w-3 mr-1" /> JSON ({preview.estimatedSizeJSON})
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-[10px] flex-1 bg-background" onClick={exportCSV}>
                  <FileSpreadsheet className="h-3 w-3 mr-1" /> CSV ({preview.estimatedSizeCSV})
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-[10px] flex-1 bg-amber-50 text-amber-700 border-amber-200" onClick={exportAlertsCSV}>
                  <FileSpreadsheet className="h-3 w-3 mr-1" /> Alertas CSV
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-[10px] flex-1 bg-rose-50 text-rose-700 border-rose-200" onClick={exportAlertsPDF}>
                  <FileText className="h-3 w-3 mr-1" /> Alertas PDF
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {['failed', 'completed'].includes(job.status) && (
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
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja {
                confirmAction === "cancel" ? "cancelar este job?" :
                confirmAction === "pause" ? "pausar este job?" :
                confirmAction === "resume" ? "retomar este job?" :
                "reexecutar este job?"
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

