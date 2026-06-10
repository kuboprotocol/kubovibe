import { Check, X, Loader2, PlayCircle, Globe, ShieldCheck, Smartphone, Package, Code, AlertCircle, Terminal, History, Download, ExternalLink, QrCode, Filter, Search, Mail, Bell, FileJson, FileSpreadsheet, FileText, UserCheck, RotateCcw, FileBadge, Lock, MessageSquare, ShieldAlert, Activity, Cpu, Upload, Paperclip, Eye, Clock, Trash2, Settings, HardDrive, Calendar, Shield, Undo2, Keyboard, ListTodo, MoreVertical } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ValidationStep {
  id: string;
  label: string;
  description: string;
  status: "pending" | "validating" | "success" | "error";
  error?: string;
}

interface DeployLog {
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
  step?: string;
}

interface DeployHistoryItem {
  id: string;
  date: string;
  environment: "staging" | "production";
  status: "success" | "error" | "blocked";
  commit: string;
  pwaUrl: string;
  apkUrl: string;
  logs: DeployLog[];
  failedStepId?: string;
  user?: string;
  evidence?: string[];
  healthStatus?: "up" | "down" | "unchecked";
  healthDetails?: string;
  parameters: {
    environment: "staging" | "production";
    notifications: { email: boolean; webhook: boolean };
    commit: string;
    dryRun?: boolean;
    approvalComment?: string;
    approvalTerms?: boolean;
    healthCheck?: boolean;
    evidenceCount?: number;
  };
}

interface ActiveDeploy {
  id: string;
  environment: string;
  user: string;
  timestamp: string;
}

interface RetentionPolicy {
  environment: "staging" | "production";
  maxSizeMB: number;
  expirationDays: number;
  autoDelete: boolean;
}

interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // Simulated signed URL
  thumbnail?: string;
  scannedAt: string;
  scanResult: "clean" | "infected" | "suspicious";
  hash: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: "download_requested" | "download_authorized" | "download_denied" | "retention_cleanup";
  user: string;
  attachmentName: string;
  reason: string;
  status: "success" | "denied" | "info";
  exportParams?: {
    range?: { start: number; end: number };
    filters?: string;
    total?: number;
    columns?: string[];
  };
}



interface AuditHistoryManagerProps {
  logs: AuditLog[];
  filterByAttachment?: string;
  title?: string;
  showFilters?: boolean;
  userRole: string;
  originalApprover?: string;
}

function AuditHistoryManager({ 
  logs, 
  filterByAttachment, 
  title, 
  showFilters = true, 
  userRole,
  originalApprover,
  onAuditLog // Add this callback to handle logging from within this sub-component
}: AuditHistoryManagerProps & { onAuditLog: (log: Omit<AuditLog, "id" | "timestamp">) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [attachmentFilter, setAttachmentFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"timestamp" | "attachmentName" | "status">(() => {
    const saved = localStorage.getItem("audit_sortField");
    return (saved as any) || "timestamp";
  });
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    const saved = localStorage.getItem("audit_sortOrder");
    return (saved as any) || "desc";
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem("audit_itemsPerPage");
    return saved ? parseInt(saved, 10) : 25;
  });

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("audit_visibleColumns");
    return saved ? JSON.parse(saved) : ["timestamp", "user", "attachmentName", "action", "reason", "status"];
  });

  useEffect(() => {
    localStorage.setItem("audit_itemsPerPage", itemsPerPage.toString());
  }, [itemsPerPage]);

  useEffect(() => {
    localStorage.setItem("audit_visibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem("audit_sortField", sortField);
  }, [sortField]);

  useEffect(() => {
    localStorage.setItem("audit_sortOrder", sortOrder);
  }, [sortOrder]);

  // Reset page when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, userFilter, attachmentFilter, sortField, sortOrder, itemsPerPage]);

  // Reset page when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, userFilter, attachmentFilter, sortField, sortOrder]);

  const isAdmin = userRole === "admin";
  const isDev = userRole === "developer";
  const isOriginalApprover = originalApprover && userRole === originalApprover;
  const canViewHistory = isAdmin || isDev || isOriginalApprover;

  const filteredLogs = useMemo(() => {
    if (!canViewHistory) return [];
    
    return logs
      .filter(log => {
        const matchesSearch = searchTerm === "" || 
          log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.attachmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.reason.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === "all" || log.status === statusFilter;
        const matchesUser = userFilter === "all" || log.user === userFilter;
        const matchesAttachment = (filterByAttachment ? log.attachmentName === filterByAttachment : true) && 
                                  (attachmentFilter === "all" || log.attachmentName === attachmentFilter);
        
        return matchesSearch && matchesStatus && matchesUser && matchesAttachment;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === "timestamp") {
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        } else if (sortField === "attachmentName") {
          comparison = a.attachmentName.localeCompare(b.attachmentName);
        } else if (sortField === "status") {
          comparison = a.status.localeCompare(b.status);
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });
  }, [logs, searchTerm, statusFilter, userFilter, attachmentFilter, sortField, sortOrder, filterByAttachment, canViewHistory]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [isExportLogOpen, setIsExportLogOpen] = useState(false);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLog | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [logExportColumns, setLogExportColumns] = useState<string[]>(["timestamp", "user", "range", "filters", "total"]);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportMode, setExportMode] = useState<"filtered" | "current_page" | "range">(() => {
    const saved = localStorage.getItem("audit_last_exportMode");
    return (saved as any) || "filtered";
  });
  const [exportRange, setExportRange] = useState(() => {
    const saved = localStorage.getItem("audit_last_exportRange");
    return saved ? JSON.parse(saved) : { start: 1, end: 1 };
  });
  const [lastConfig, setLastConfig] = useState<any>(null);
  const MAX_EXPORT_LIMIT = 500;

  // Keyboard shortcut for export
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const savedShortcut = localStorage.getItem("audit_export_shortcut") || "Enter";
      
      const isMatch = e.key === savedShortcut && (e.ctrlKey || e.metaKey);
      
      if (isExportDialogOpen && isMatch) {
        e.preventDefault();
        handleExport(exportFormat);
      } else if (!isExportDialogOpen && isMatch) {
        // Trigger default export mode if shortcut is pressed while list is visible
        e.preventDefault();
        setExportFormat("csv");
        setIsExportDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExportDialogOpen, exportFormat, exportMode, exportRange]);

  useEffect(() => {
    localStorage.setItem("audit_last_exportMode", exportMode);
    localStorage.setItem("audit_last_exportRange", JSON.stringify(exportRange));
  }, [exportMode, exportRange]);

  const handleExport = async (format: "csv" | "pdf") => {
    if (!canViewHistory) {
      const errorMsg = "ERR_AUTH_DENIED: Acesso Negado: Apenas Dev, Admin ou o Aprovador original podem visualizar ou exportar este histórico.";
      toast.error("Permissão negada", { description: errorMsg });
      return;
    }

    // Validation for page range
    if (exportMode === "range") {
      if (exportRange.start < 1 || exportRange.start > totalPages || exportRange.end < exportRange.start || exportRange.end > totalPages) {
        toast.error("Intervalo inválido", { 
          description: `Por favor, informe um intervalo entre 1 e ${totalPages}, onde a página inicial é menor ou igual à final.` 
        });
        return;
      }
    }

    if (logExportColumns.length === 0) {
      toast.error("Seleção inválida", { description: "Você precisa selecionar ao menos uma coluna para exportar." });
      return;
    }

    let baseLogs = [];
    if (exportMode === "current_page") {
      baseLogs = paginatedLogs;
    } else if (exportMode === "range") {
      const start = (exportRange.start - 1) * itemsPerPage;
      const end = exportRange.end * itemsPerPage;
      baseLogs = filteredLogs.slice(start, end);
    } else {
      baseLogs = filteredLogs;
    }

    if (baseLogs.length > MAX_EXPORT_LIMIT) {
      toast.warning("Limite de exportação atingido", { 
        description: `O arquivo conterá apenas os primeiros ${MAX_EXPORT_LIMIT} registros selecionados.` 
      });
    }

    const logsToExport = baseLogs.slice(0, MAX_EXPORT_LIMIT);

    if (format === "csv") {
      const headers = logExportColumns.map(c => {
        const map: any = { 
          timestamp: "Data/Hora", 
          user: "Usuário", 
          range: "Intervalo", 
          filters: "Filtros", 
          total: "Total",
          attachmentName: "Anexo", 
          status: "Status",
          id: "ID",
          action: "Ação",
          reason: "Motivo"
        };
        return map[c] || c;
      });

      const rows = logsToExport.map(log => logExportColumns.map(c => {
        if (c === "timestamp") return new Date(log.timestamp).toLocaleString();
        if (c === "range") return log.exportParams?.range ? `${log.exportParams.range.start}-${log.exportParams.range.end}` : "N/A";
        if (c === "filters") return log.exportParams?.filters || "Nenhum";
        if (c === "total") return log.exportParams?.total || "0";
        return (log as any)[c] || "";
      }));
      
      const csvContent = [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_log_${exportMode}_${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(title || "Relatório de Auditoria Filtrado", 14, 15);
        doc.setFontSize(10);
        let scopeDesc = exportMode === "current_page" ? `Página Atual (${currentPage})` : 
                        exportMode === "range" ? `Páginas ${exportRange.start}-${exportRange.end}` : "Todos Filtrados";
        doc.text(`Filtros: ${searchTerm || "Nenhum"} | Status: ${statusFilter} | Escopo: ${scopeDesc} | Qtd: ${logsToExport.length}`, 14, 22);
        
        const colMap: Record<string, string> = {
          timestamp: 'Timestamp',
          user: 'Usuário',
          attachmentName: 'Anexo',
          action: 'Ação',
          status: 'Status',
          reason: 'Motivo',
          id: 'ID',
          range: 'Intervalo',
          filters: 'Filtros',
          total: 'Total'
        };

        const activeHeaders = logExportColumns.map(c => colMap[c] || c);
        const tableBody = logsToExport.map(log => logExportColumns.map(col => {
          if (col === 'timestamp') return new Date(log.timestamp).toLocaleString();
          if (col === "range") return log.exportParams?.range ? `${log.exportParams.range.start}-${log.exportParams.range.end}` : "N/A";
          if (col === "filters") return log.exportParams?.filters || "Nenhum";
          if (col === "total") return log.exportParams?.total || "0";
          return (log as any)[col] || "";
        }));

        (autoTable as any)(doc, {
          head: [activeHeaders],
          body: tableBody,
          startY: 28,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [0, 102, 204] }
        });
        
        doc.save(`audit_log_${exportMode}_${new Date().toISOString()}.pdf`);
      } catch (error) {
        toast.error("Erro ao gerar PDF");
        return;
      }
    }

    onAuditLog({
      action: "download_authorized",
      user: userRole,
      attachmentName: `Exportação ${format.toUpperCase()} (${exportMode === "current_page" ? `Pág. ${currentPage}` : exportMode === "range" ? `Págs. ${exportRange.start}-${exportRange.end}` : "Filtrado"})`,
      reason: `Filtros: ${searchTerm || "Nenhum"}, Status: ${statusFilter}, Ordenação: ${sortField} ${sortOrder}, Colunas: ${visibleColumns.join(",")}, Recorte: ${exportMode === "range" ? `Páginas ${exportRange.start} a ${exportRange.end} (Total: ${logsToExport.length} registros, Índices: ${(exportRange.start-1)*itemsPerPage+1}-${Math.min(filteredLogs.length, exportRange.end*itemsPerPage)})` : `${logsToExport.length} registros`}, PágInicial: ${exportMode === "range" ? exportRange.start : 1}, PágFinal: ${exportMode === "range" ? exportRange.end : (exportMode === "current_page" ? 1 : totalPages)}, TotalRecorte: ${logsToExport.length}`,
      status: "success",
      exportParams: {
        range: exportMode === "range" ? exportRange : undefined,
        filters: `Busca: ${searchTerm || "Nenhuma"}, Status: ${statusFilter}`,
        total: logsToExport.length,
        columns: visibleColumns
      }
    });
    
    toast.success("Histórico exportado com sucesso");
    setIsExportDialogOpen(false);
  };

  const uniqueUsers = Array.from(new Set(logs.map(l => l.user)));
  const uniqueAttachments = Array.from(new Set(logs.map(l => l.attachmentName)));

  if (!canViewHistory) {
    return (
      <div className="p-8 text-center border rounded-lg bg-destructive/5 border-destructive/20">
        <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <h4 className="text-sm font-bold text-destructive">Acesso Restrito</h4>
        <p className="text-xs text-muted-foreground">Você não tem permissão para visualizar este histórico de auditoria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Diálogo de confirmação de exportação */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Opções de Exportação ({exportFormat.toUpperCase()})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Escopo da Exportação</label>
              <Select value={exportMode} onValueChange={(v: any) => setExportMode(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filtered">Todos os resultados filtrados ({filteredLogs.length})</SelectItem>
                  <SelectItem value="current_page">Apenas a página atual (Pág. {currentPage})</SelectItem>
                  <SelectItem value="range">Intervalo de páginas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exportMode === "range" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase">De (Página)</label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={totalPages} 
                      value={exportRange.start} 
                      onChange={e => setExportRange(prev => ({ ...prev, start: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className={cn("h-8 text-xs", (exportRange.start < 1 || exportRange.start > totalPages) && "border-destructive")}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase">Até (Página)</label>
                    <Input 
                      type="number" 
                      min={exportRange.start} 
                      max={totalPages} 
                      value={exportRange.end} 
                      onChange={e => setExportRange(prev => ({ ...prev, end: Math.min(totalPages, Math.max(exportRange.start, parseInt(e.target.value) || 1)) }))}
                      className={cn("h-8 text-xs", (exportRange.end < exportRange.start || exportRange.end > totalPages) && "border-destructive")}
                    />
                  </div>
                </div>
                {exportRange.start < 1 && (
                  <p className="text-[9px] text-destructive font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Página inicial não pode ser menor que 1.
                  </p>
                )}
                {exportRange.start > totalPages && (
                  <p className="text-[9px] text-destructive font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Página inicial ({exportRange.start}) excede o total ({totalPages}).
                  </p>
                )}
                {exportRange.end < exportRange.start && (
                  <p className="text-[9px] text-destructive font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Página final não pode ser menor que a inicial.
                  </p>
                )}
                {exportRange.end > totalPages && (
                  <p className="text-[9px] text-destructive font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Página final ({exportRange.end}) excede o total ({totalPages}).
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Colunas no CSV/PDF</label>
              <div className="grid grid-cols-2 gap-2 p-2 rounded-md border border-border/40 bg-muted/20">
                {[
                  { id: "timestamp", label: "Data/Hora" },
                  { id: "user", label: "Usuário" },
                  { id: "range", label: "Intervalo" },
                  { id: "filters", label: "Filtros" },
                  { id: "total", label: "Total" },
                  { id: "attachmentName", label: "Anexo" },
                  { id: "status", label: "Status" }
                ].map(col => (
                  <div key={col.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`export-col-${col.id}`} 
                      checked={logExportColumns.includes(col.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setLogExportColumns([...logExportColumns, col.id]);
                        else setLogExportColumns(logExportColumns.filter(c => c !== col.id));
                      }}
                    />
                    <label htmlFor={`export-col-${col.id}`} className="text-[10px] cursor-pointer leading-none truncate">{col.label}</label>
                  </div>
                ))}
              </div>
              {logExportColumns.length === 0 && (
                <p className="text-[9px] text-destructive font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Selecione ao menos uma coluna.
                </p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border/40 space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Registros:</span>
                <span className="font-bold">
                  {exportMode === "current_page" ? paginatedLogs.length : 
                   exportMode === "range" ? Math.min(filteredLogs.length, (exportRange.end - exportRange.start + 1) * itemsPerPage) : 
                   filteredLogs.length}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Colunas:</span>
                <span className="font-bold">{logExportColumns.length}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(false)}>Cancelar</Button>
            <Button 
              size="sm" 
              onClick={() => handleExport(exportFormat)} 
              disabled={logExportColumns.length === 0 || filteredLogs.length === 0 || (exportMode === "range" && (exportRange.start < 1 || exportRange.start > totalPages || exportRange.end < exportRange.start || exportRange.end > totalPages))}
            >
              <Keyboard className="h-3 w-3 mr-2 opacity-50" />
              Confirmar Download (Ctrl+Enter)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportLogOpen} onOpenChange={setIsExportLogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              Log de Auditoria de Exportações
            </DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[11px]"
                onClick={() => { setExportFormat("csv"); setIsExportDialogOpen(true); }}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />
                Exportar Histórico de Logs
              </Button>
            </div>
          </DialogHeader>

          {/* Modal de Detalhes do Log */}
          <Dialog open={!!selectedLogForDetails} onOpenChange={(open) => !open && setSelectedLogForDetails(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4 text-primary" />
                  Detalhes da Exportação
                </DialogTitle>
              </DialogHeader>
              {selectedLogForDetails && (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div className="space-y-1">
                      <p className="text-muted-foreground uppercase font-bold text-[9px]">ID do Log</p>
                      <p className="font-mono">{selectedLogForDetails.id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground uppercase font-bold text-[9px]">Data/Hora</p>
                      <p>{new Date(selectedLogForDetails.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground uppercase font-bold text-[9px]">Usuário</p>
                      <p>{selectedLogForDetails.user}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground uppercase font-bold text-[9px]">Tipo/Arquivo</p>
                      <p>{selectedLogForDetails.attachmentName}</p>
                    </div>
                  </div>

                  <div className="space-y-2 p-3 bg-muted/40 rounded-lg border border-border/20">
                    <p className="text-[10px] font-bold uppercase text-primary">Parâmetros do Export</p>
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div className="space-y-1">
                        <p className="text-muted-foreground font-medium">Intervalo:</p>
                        <p>{selectedLogForDetails.exportParams?.range ? `Páginas ${selectedLogForDetails.exportParams.range.start} a ${selectedLogForDetails.exportParams.range.end}` : "N/A"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground font-medium">Total de Registros:</p>
                        <p>{selectedLogForDetails.exportParams?.total || "N/A"}</p>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <p className="text-muted-foreground font-medium">Filtros Aplicados:</p>
                        <p className="bg-background p-1.5 rounded border text-[10px]">{selectedLogForDetails.exportParams?.filters || "Nenhum"}</p>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <p className="text-muted-foreground font-medium">Colunas Incluídas:</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedLogForDetails.exportParams?.columns?.map(c => (
                            <Badge key={c} variant="outline" className="text-[8px] h-4 py-0">{c}</Badge>
                          )) || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedLogForDetails(null)}>Fechar</Button>
                    <Button size="sm" onClick={() => {
                      // Trigger re-export logic if needed, but for now just close
                      setSelectedLogForDetails(null);
                      setIsExportDialogOpen(true);
                      toast.info("Configurações carregadas para nova exportação");
                    }}>
                      Exportar Novamente
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Modal de Configuração de Colunas do Log CSV */}
          <Dialog open={isLogExportDialogOpen} onOpenChange={setIsLogExportDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Configurar Colunas do Log (CSV)
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-xs text-muted-foreground">Selecione as colunas que deseja incluir no arquivo CSV do histórico de exportações.</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "timestamp", label: "Data/Hora" },
                    { id: "user", label: "Usuário" },
                    { id: "range", label: "Intervalo (Páginas)" },
                    { id: "filters", label: "Filtros Aplicados" },
                    { id: "total", label: "Total de Registros" },
                    { id: "attachmentName", label: "Tipo de Exportação" },
                    { id: "status", label: "Status" }
                  ].map(col => (
                    <div key={col.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`log-col-${col.id}`} 
                        checked={logExportColumns.includes(col.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setLogExportColumns([...logExportColumns, col.id]);
                          else setLogExportColumns(logExportColumns.filter(c => c !== col.id));
                        }}
                      />
                      <label htmlFor={`log-col-${col.id}`} className="text-xs cursor-pointer">{col.label}</label>
                    </div>
                  ))}
                </div>
                {logExportColumns.length === 0 && (
                  <p className="text-[10px] text-destructive font-bold flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Selecione ao menos uma coluna para exportar.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsLogExportDialogOpen(false)}>Cancelar</Button>
                <Button 
                  size="sm" 
                  disabled={logExportColumns.length === 0}
                  onClick={() => {
                    if (logExportColumns.length === 0) {
                      toast.error("Seleção inválida", { description: "Você precisa selecionar ao menos uma coluna para o CSV." });
                      return;
                    }

                    // Respect filtered results (search, filters, etc)
                    const exportLogs = filteredLogs;
                    
                    const headers = logExportColumns.map(c => {
                      const map: any = { 
                        timestamp: "Data/Hora", 
                        user: "Usuário", 
                        range: "Intervalo", 
                        filters: "Filtros", 
                        total: "Total",
                        attachmentName: "Tipo", 
                        status: "Status" 
                      };
                      return map[c];
                    });

                    const rows = exportLogs.map(l => logExportColumns.map(c => {
                      if (c === "timestamp") return new Date(l.timestamp).toLocaleString();
                      if (c === "range") return l.exportParams?.range ? `${l.exportParams.range.start}-${l.exportParams.range.end}` : "N/A";
                      if (c === "filters") return l.exportParams?.filters || "Nenhum";
                      if (c === "total") return l.exportParams?.total || "0";
                      return (l as any)[c];
                    }));
                    
                    const csvContent = [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `audit_history_filtered_${new Date().toISOString()}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setIsLogExportDialogOpen(false);
                    toast.success("Histórico de logs exportado!", { 
                      description: `${exportLogs.length} registros incluídos respeitando os filtros atuais.` 
                    });
                  }}
                >
                  Baixar CSV
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="flex-1 overflow-hidden mt-4">
            <AuditHistoryManager 
              logs={logs.filter(l => l.action === "download_authorized")}
              userRole={userRole}
              originalApprover={originalApprover}
              onAuditLog={onAuditLog}
              title="Log de Exportações"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsExportLogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-muted/30 p-2.5 rounded-lg border border-border/20 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Resumo:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {searchTerm && <Badge variant="secondary" className="text-[9px] h-4">Busca: "{searchTerm}"</Badge>}
          {statusFilter !== "all" && <Badge variant="secondary" className="text-[9px] h-4">Status: {statusFilter}</Badge>}
          {userFilter !== "all" && <Badge variant="secondary" className="text-[9px] h-4">Usuário: {userFilter}</Badge>}
          {attachmentFilter !== "all" && <Badge variant="secondary" className="text-[9px] h-4">Anexo: {attachmentFilter}</Badge>}
          {filterByAttachment && <Badge variant="secondary" className="text-[9px] h-4">Contexto: {filterByAttachment}</Badge>}
          <Badge variant="outline" className="text-[9px] h-4 border-primary/20 bg-primary/5">Ordem: {sortField} ({sortOrder === "asc" ? "Cresc" : "Decresc"})</Badge>
          <Badge variant="outline" className="text-[9px] h-4">Exibindo {paginatedLogs.length} de {filteredLogs.length}</Badge>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, anexo ou motivo..."
              className="pl-8 h-8 text-[11px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="denied">Negado</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => { setExportFormat("csv"); setIsExportDialogOpen(true); }} title="CSV">
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => { setExportFormat("pdf"); setIsExportDialogOpen(true); }} title="PDF">
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setIsExportLogOpen(true)} title="Log de Exportações">
              <ListTodo className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2">
                  <Filter className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Configurações da Lista</span>
                  <div className="flex gap-1">
                    {lastConfig && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 text-primary hover:text-primary/80"
                        title="Desfazer Reset"
                        onClick={() => {
                          setVisibleColumns(lastConfig.columns);
                          setItemsPerPage(lastConfig.itemsPerPage);
                          setSortField(lastConfig.sortField);
                          setSortOrder(lastConfig.sortOrder);
                          setLastConfig(null);
                          toast.success("Configurações recuperadas!");
                        }}
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      title="Resetar Preferências"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja resetar todas as preferências de exibição da auditoria para o padrão?")) {
                          setLastConfig({
                            columns: visibleColumns,
                            itemsPerPage,
                            sortField,
                            sortOrder
                          });
                          localStorage.removeItem("audit_visibleColumns");
                          localStorage.removeItem("audit_itemsPerPage");
                          localStorage.removeItem("audit_sortField");
                          localStorage.removeItem("audit_sortOrder");
                          // Instead of reload, just set defaults to allow "Undo"
                          setVisibleColumns(["timestamp", "user", "attachmentName", "action", "reason", "status"]);
                          setItemsPerPage(25);
                          setSortField("timestamp");
                          setSortOrder("desc");
                          toast.info("Preferências resetadas", { description: "Você pode desfazer esta ação no menu de filtros." });
                        }
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Atalho de Teclado (Ctrl + ...)</p>
                    <Select 
                      value={localStorage.getItem("audit_export_shortcut") || "Enter"} 
                      onValueChange={(v) => {
                        localStorage.setItem("audit_export_shortcut", v);
                        toast.success(`Atalho alterado para Ctrl+${v}`);
                      }}
                    >
                      <SelectTrigger className="h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Enter">Enter</SelectItem>
                        <SelectItem value="e">E</SelectItem>
                        <SelectItem value="s">S</SelectItem>
                        <SelectItem value="p">P</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Colunas Visíveis</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {[
                        { id: "timestamp", label: "Data/Hora" },
                        { id: "user", label: "Usuário" },
                        { id: "attachmentName", label: "Anexo" },
                        { id: "action", label: "Ação" },
                        { id: "reason", label: "Motivo" },
                        { id: "status", label: "Status" },
                        { id: "id", label: "ID" }
                      ].map(col => (
                        <div key={col.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`col-${col.id}`} 
                            checked={visibleColumns.includes(col.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setVisibleColumns([...visibleColumns, col.id]);
                              else if (visibleColumns.length > 1) setVisibleColumns(visibleColumns.filter(c => c !== col.id));
                            }}
                          />
                          <label htmlFor={`col-${col.id}`} className="text-[10px] font-medium cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{col.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Filtro por Usuário</p>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger className="h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Usuários</SelectItem>
                        {uniqueUsers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!filterByAttachment && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Anexo</p>
                      <Select value={attachmentFilter} onValueChange={setAttachmentFilter}>
                        <SelectTrigger className="h-7 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos Anexos</SelectItem>
                          {uniqueAttachments.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Ordenar por</p>
                    <div className="flex gap-1">
                      <Select value={sortField} onValueChange={(v: any) => setSortField(v)}>
                        <SelectTrigger className="h-7 text-[10px] flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timestamp">Data</SelectItem>
                          <SelectItem value="attachmentName">Anexo</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0" 
                        onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                      >
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </Button>
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <ScrollArea className={cn("rounded-md border border-border/20 bg-background/50", showFilters ? "h-[350px]" : "h-40")}>
        <div className="p-2 space-y-2">
          {paginatedLogs.length === 0 && (
            <p className="text-[10px] text-center text-muted-foreground italic py-8">Nenhum registro encontrado.</p>
          )}
          <div className="bg-muted/10 rounded-md border border-border/20 overflow-hidden">
            <div className="grid grid-cols-7 gap-2 px-3 py-2 bg-muted/40 border-b border-border/30 text-[9px] font-bold text-muted-foreground uppercase">
              {visibleColumns.includes("timestamp") && <div>Data/Hora</div>}
              {visibleColumns.includes("user") && <div>Usuário</div>}
              {visibleColumns.includes("attachmentName") && <div>Anexo</div>}
              {visibleColumns.includes("action") && <div>Ação</div>}
              {visibleColumns.includes("reason") && <div>Motivo</div>}
              {visibleColumns.includes("status") && <div>Status</div>}
              {visibleColumns.includes("id") && <div>ID</div>}
            </div>
            <div className="divide-y divide-border/20">
              {paginatedLogs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-7 gap-2 px-3 py-2 items-center text-[10px] hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedLogForDetails(log)}
                >
                  {visibleColumns.includes("timestamp") && (
                    <div className="text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                  )}
                  {visibleColumns.includes("user") && (
                    <div className="font-medium truncate">{log.user}</div>
                  )}
                  {visibleColumns.includes("attachmentName") && (
                    <div className="truncate italic text-muted-foreground" title={log.attachmentName}>
                      {log.attachmentName}
                    </div>
                  )}
                  {visibleColumns.includes("action") && (
                    <div className="truncate capitalize text-[9px]">
                      {log.action.replace("_", " ")}
                    </div>
                  )}
                  {visibleColumns.includes("reason") && (
                    <div className="truncate text-muted-foreground" title={log.reason}>
                      {log.reason}
                    </div>
                  )}
                  {visibleColumns.includes("status") && (
                    <div>
                      <Badge variant={log.status === "success" ? "secondary" : log.status === "denied" ? "destructive" : "outline"} className="h-4 text-[8px] uppercase px-1 py-0">
                        {log.status === "success" ? "Autorizado" : log.status === "denied" ? "Negado" : "Info"}
                      </Badge>
                    </div>
                  )}
                  {visibleColumns.includes("id") && (
                    <div className="font-mono text-[8px] text-muted-foreground truncate">{log.id.split("-")[0]}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[9px] text-muted-foreground">Mostrando {paginatedLogs.length} de {filteredLogs.length} registros</p>
          <div className="flex items-center gap-2">
            <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
              <SelectTrigger className="h-7 w-20 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / pág</SelectItem>
                <SelectItem value="50">50 / pág</SelectItem>
                <SelectItem value="100">100 / pág</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px]"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-[10px]">Pág {currentPage} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px]"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeliveryFlow() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");
  const [logs, setLogs] = useState<DeployLog[]>([]);
  const [activeTab, setActiveTab] = useState("current");
  const [historySearch, setHistorySearch] = useState("");
  const [historyUserSearch, setHistoryUserSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [showQR, setShowQR] = useState(false);
  const [notifications, setNotifications] = useState({ email: true, webhook: false });
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin"); // Mock role: 'admin', 'developer', 'viewer'
  const [pendingApproval, setPendingApproval] = useState<boolean>(false);
  const [currentCommit, setCurrentCommit] = useState<string>(() => Math.random().toString(36).substring(7));
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalTerms, setApprovalTerms] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [activeDeploys, setActiveDeploys] = useState<ActiveDeploy[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>(() => {
    const saved = localStorage.getItem("deploy_retention_policies");
    return saved ? JSON.parse(saved) : [
      { environment: "staging", maxSizeMB: 10, expirationDays: 7, autoDelete: true },
      { environment: "production", maxSizeMB: 50, expirationDays: 30, autoDelete: false }
    ];
  });
  
  const currentPolicy = useMemo(() => 
    retentionPolicies.find(p => p.environment === environment) || retentionPolicies[0]
  , [retentionPolicies, environment]);

  const maxEvidenceSize = currentPolicy.maxSizeMB * 1024 * 1024;
  const [allowedTypes] = useState(["image/png", "image/jpeg", "application/pdf", "text/plain"]);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem("deploy_audit_logs");
    return saved ? JSON.parse(saved) : [];
  });

  const addAuditLog = (log: Omit<AuditLog, "id" | "timestamp">) => {
    const newLog: AuditLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 100);
      localStorage.setItem("deploy_audit_logs", JSON.stringify(updated));
      return updated;
    });
  };


  const [steps, setSteps] = useState<ValidationStep[]>([
    { id: "ci", label: "CI & Testes de Integração", description: "Executando suíte de testes automatizados", status: "pending" },
    { id: "build", label: "Build & Minificação", description: "Otimizando código e recursos para produção", status: "pending" },
    { id: "api", label: "Validação de Infra", description: "Configurando segredos e conexões do banco", status: "pending" },
    { id: "pwa", label: "Deploy Web (PWA)", description: "Publicação com HTTPS e Service Workers", status: "pending" },
    { id: "apk", label: "Assinatura & APK", description: "Gerando pacote assinado para Android", status: "pending" },
  ]);

  const [history, setHistory] = useState<DeployHistoryItem[]>(() => {
    const saved = localStorage.getItem("deploy_history");
    return saved ? JSON.parse(saved) : [];
  });


  const canExecuteDeploy = useMemo(() => {
    if (environment === "production") return currentUserRole === "admin";
    return currentUserRole === "admin" || currentUserRole === "developer";
  }, [environment, currentUserRole]);

  useEffect(() => {
    localStorage.setItem("deploy_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("deploy_retention_policies", JSON.stringify(retentionPolicies));
  }, [retentionPolicies]);

  // Routine job for retention policy (Simulated)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[Retention Job] Checking for expired attachments...");
      const now = new Date();
      setHistory(prev => {
        let changed = false;
        const newHistory = prev.map(item => {
          const policy = retentionPolicies.find(p => p.environment === item.environment);
          if (policy?.autoDelete) {
            const deployDate = new Date(item.date);
            const diffDays = (now.getTime() - deployDate.getTime()) / (1000 * 3600 * 24);
            if (diffDays > policy.expirationDays && item.evidence && item.evidence.length > 0) {
              console.log(`[Retention Job] Expiring evidence for deploy ${item.commit} (${item.environment})`);
              addAuditLog({
                action: "retention_cleanup",
                user: "system",
                attachmentName: item.evidence?.join(", ") || "N/A",
                reason: `Expiração de ${policy.expirationDays} dias atingida para ${item.environment}`,
                status: "info"
              });
              changed = true;
              return { ...item, evidence: [], detailedEvidence: [] };
            }
          }
          return item;
        });
        return changed ? newHistory : prev;
      });
    }, 60000); // Check every minute in simulation
    return () => clearInterval(interval);
  }, [retentionPolicies]);

  const addLog = (message: string, level: DeployLog["level"] = "info", step?: string) => {
    const newLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      step
    };
    setLogs(prev => [newLog, ...prev]);
    return newLog;
  };

  const notifyResult = async (status: "success" | "error", env: string, attempt = 1, pwaUrl?: string, evidence?: string[]) => {
    // Retry logic & Deduplication (simulated)
    const notificationPayload = {
      status,
      environment: env,
      timestamp: new Date().toISOString(),
      pwaUrl: pwaUrl || "https://kubovibe.app",
      steps: steps.map(s => ({ id: s.id, label: s.label, status: s.status })),
      evidenceReferences: evidence || []
    };

    if (notifications.email) {
      console.log(`[Notification] Enviando e-mail de resumo (Tentativa ${attempt})...`, notificationPayload);
      try {
        // Mock success with 90% chance
        if (Math.random() < 0.9) {
          toast.success(`E-mail de notificação enviado (${status})`);
        } else throw new Error("Falha no servidor de e-mail");
      } catch (err) {
        if (attempt < 3) {
          console.warn("Retrying email notification...");
          setTimeout(() => notifyResult(status, env, attempt + 1, pwaUrl, evidence), 2000);
        } else {
          toast.error("Falha ao enviar e-mail após 3 tentativas");
        }
      }
    }

    if (notifications.webhook) {
      console.log(`[Notification] Disparando webhook para Slack/Teams (Tentativa ${attempt})...`, notificationPayload);
      toast.info(`Webhook disparado para o ambiente ${env}`);
    }
  };

  const runValidation = async (resumeFromStepId?: string, previousLogs: DeployLog[] = [], forcedCommit?: string) => {
    if (!canExecuteDeploy) {
      toast.error("Permissão negada", { description: "Você não tem permissão para realizar deploy neste ambiente." });
      return;
    }

    // Check for concurrent deploys in the same environment
    const environmentLock = activeDeploys.find(d => d.environment === environment);
    if (environmentLock && !isDryRun) {
      toast.error("Bloqueio de Ambiente", { 
        description: `O ambiente ${environment.toUpperCase()} já está em deploy por ${environmentLock.user}. Aguarde a conclusão.` 
      });
      
      const blockedItem: DeployHistoryItem = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        environment,
        status: "blocked",
        commit: currentCommit,
        pwaUrl: "",
        apkUrl: "",
        logs: [{ timestamp: new Date().toLocaleTimeString(), level: "warning", message: `Tentativa de deploy bloqueada por concorrência (Usuário: ${currentUserRole})` }],
        user: currentUserRole,
        parameters: { environment, notifications, commit: currentCommit }
      };
      setHistory(prev => [blockedItem, ...prev]);
      addLog(`Tentativa de deploy bloqueada por concorrência em ${environment.toUpperCase()} (Usuário: ${currentUserRole})`, "warning");
      return;
    }


    // Require approval for production if not admin
    if (environment === "production" && currentUserRole !== "admin" && !pendingApproval) {
      setPendingApproval(true);
      toast.info("Aprovação Solicitada", { description: "Aguardando aprovação de um administrador para deploy em produção." });
      return;
    }

    if (environment === "production" && !isDryRun) {
      if (!approvalComment.trim() || !approvalTerms) {
        toast.error("Campos Obrigatórios", { description: "É necessário fornecer um comentário e aceitar os termos de aprovação." });
        setPendingApproval(true);
        return;
      }
    }

    const deployId = crypto.randomUUID();
    if (!isDryRun) {
      setActiveDeploys(prev => [...prev, { id: deployId, environment, user: currentUserRole, timestamp: new Date().toISOString() }]);
    }

    setIsDeploying(true);
    setPendingApproval(false);
    setProgress(0);
    
    let currentLogs = resumeFromStepId ? [...previousLogs] : [];
    if (!resumeFromStepId) {
      setLogs([]);
      currentLogs = [];
      if (!forcedCommit) setCurrentCommit(Math.random().toString(36).substring(7));
    } else {
      setLogs(currentLogs);
    }
    const finalCommit = forcedCommit || currentCommit;

    const startIdx = resumeFromStepId ? steps.findIndex(s => s.id === resumeFromStepId) : 0;
    const newSteps: ValidationStep[] = steps.map((s, idx) => {
      if (idx < startIdx) return { ...s, status: "success" as const };
      return { ...s, status: "pending" as const, error: undefined };
    });
    setSteps(newSteps);

    addLog(`${isDryRun ? "[DRY-RUN] " : ""}${resumeFromStepId ? "Retomando" : "Iniciando"} deploy em ambiente: ${environment.toUpperCase()} (Commit: ${finalCommit})`, "info");

    let finalStatus: "success" | "error" = "success";
    let failedStepId: string | undefined;

    for (let i = startIdx; i < newSteps.length; i++) {
      const step = newSteps[i];
      step.status = "validating" as const;
      setSteps([...newSteps]);
      
      addLog(`Processando etapa: ${step.label}...`, "info", step.id);
      
      // Simulating build/upload integration tests during dry-run or real deploy
      if (step.id === "ci") {
        addLog("Executando testes automatizados de integração...", "info", step.id);
        addLog("Validando parâmetros, credenciais e etapas de build/upload...", "info", step.id);
        await new Promise(r => setTimeout(r, 1200));
        addLog("Suite de testes concluída: 42 testes passaram, 0 falharam.", "success", step.id);
      }

      if (step.id === "build") {
        addLog("Validando parâmetros e credenciais de build...", "info", step.id);
        await new Promise(r => setTimeout(r, 800));
      }

      await new Promise(r => setTimeout(r, 1500));

      
      if (isDryRun && Math.random() < 0.1) {
        step.status = "error" as const;
        step.error = "Simulação de falha em modo Dry-Run.";
        addLog(step.error, "error", step.id);
        finalStatus = "error";
        failedStepId = step.id;
        break;
      }

      if (!isDryRun && step.id === "api" && Math.random() < 0.2) {
        step.status = "error" as const;
        step.error = "Falha na validação de credenciais da API.";
        addLog(step.error, "error", step.id);
        setSteps([...newSteps]);
        finalStatus = "error";
        failedStepId = step.id;
        break;
      }

      step.status = "success" as const;
      addLog(`${step.label} concluído com sucesso.`, "success", step.id);
      setProgress(((i + 1) / newSteps.length) * 100);
      setSteps([...newSteps]);
    }

    // Post-deploy health check with retries and window
    let healthStatus: "up" | "down" | "unchecked" = "unchecked";
    let healthDetails = "";
    if (finalStatus === "success" && !isDryRun) {
      addLog("Iniciando Health-Check automático do link público (Janela de 30s)...", "info");
      
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        attempts++;
        addLog(`Verificando disponibilidade (Tentativa ${attempts}/${maxAttempts})...`, "info");
        await new Promise(r => setTimeout(r, 2000));
        
        const isUp = Math.random() > 0.2; // 80% chance of being up in simulation
        if (isUp) {
          healthStatus = "up";
          healthDetails = "Status 200 OK - Resposta em 142ms. Link público acessível.";
          addLog(`Health-Check: ONLINE (200 OK)`, "success");
          break;
        } else {
          addLog(`Health-Check: OFFLINE / ERRO 500 (Aguardando propagação...)`, "warning");
          if (attempts === maxAttempts) {
            healthStatus = "down";
            healthDetails = "Falha após 3 tentativas. Erro 503 Service Unavailable ou Timeout.";
            addLog(`Health-Check: FALHA DEFINITIVA após ${maxAttempts} tentativas`, "error");
          } else {
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      }
    }


    const newItem: DeployHistoryItem = {
      id: deployId,
      date: new Date().toISOString(),
      environment,
      status: finalStatus,
      commit: finalCommit,
      pwaUrl: environment === "production" ? "https://kubovibe.app" : "https://staging.kubovibe.app",
      apkUrl: "/downloads/app-latest.apk",
      logs: [...currentLogs, ...logs],
      failedStepId,
      healthStatus,
      healthDetails,
      user: currentUserRole,
      evidence: evidenceFiles.map(f => f.name),
      parameters: {
        environment,
        notifications: { ...notifications },
        commit: finalCommit,
        dryRun: isDryRun,
        approvalComment: environment === "production" ? approvalComment : undefined,
        approvalTerms: environment === "production" ? approvalTerms : undefined,
        healthCheck: true,
        evidenceCount: evidenceFiles.length
      }
    };

    // Simulated evidence with deep validation and scan
    const detailedEvidence: EvidenceFile[] = await Promise.all(evidenceFiles.map(async f => {
      // Simulate malware scan and deep validation
      await new Promise(r => setTimeout(r, 500));
      return {
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        type: f.type,
        url: `https://storage.kubovibe.app/signed/${deployId}/${f.name}?token=${Math.random().toString(36).substring(7)}&expires=${Date.now() + 3600000}`,
        thumbnail: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        scannedAt: new Date().toISOString(),
        scanResult: "clean" as const,
        hash: btoa(f.name + f.size).substring(0, 32).toLowerCase()
      };
    }));
    (newItem as any).detailedEvidence = detailedEvidence;



    if (!isDryRun) {
      setHistory(prev => [newItem, ...prev]);
    }
    
    setIsDeploying(false);
    setActiveDeploys(prev => prev.filter(d => d.id !== deployId));
    setEvidenceFiles([]);
    setApprovalComment("");
    setApprovalTerms(false);

    
    if (finalStatus === "success") {
      toast.success(isDryRun ? "Simulação finalizada com sucesso!" : "Entrega finalizada!", { 
        description: isDryRun ? "Nenhuma alteração real foi feita." : `App disponível em ${environment}` 
      });
      if (!isDryRun) addLog(`Deploy finalizado com sucesso em ${newItem.pwaUrl}`, "success");
    } else {
      toast.error(isDryRun ? "Simulação falhou" : "Deploy falhou", { 
        description: `Erro na etapa: ${steps.find(s => s.id === failedStepId)?.label}` 
      });
    }

    if (!isDryRun) notifyResult(finalStatus, environment, 1, newItem.pwaUrl, newItem.evidence);
  };

  const downloadLogs = (historyItem: DeployHistoryItem, format: "json" | "csv") => {
    const content = format === "json" 
      ? JSON.stringify(historyItem, null, 2)
      : "Timestamp,Level,Step,Message\n" + historyItem.logs.map(l => `${l.timestamp},${l.level},${l.step || ""},"${l.message}"`).join("\n");
    
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deploy-logs-${historyItem.commit}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Logs exportados em ${format.toUpperCase()}`);
  };

  const downloadAuditSummary = async (historyItem: DeployHistoryItem) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      
      const doc = new jsPDF();
      const detailedEvidence = (historyItem as any).detailedEvidence as EvidenceFile[] || [];
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(0, 102, 204);
      doc.text("Relatório de Auditoria de Deploy", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Identificador: ${historyItem.id}`, 14, 28);
      doc.text(`Data: ${new Date(historyItem.date).toLocaleString()}`, 14, 33);
      doc.text(`Responsável: ${historyItem.user?.toUpperCase() || "ADMIN"}`, 14, 38);

      // Status Section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Resumo da Execução", 14, 50);
      
      (autoTable as any)(doc, {
        startY: 55,
        head: [['Parâmetro', 'Valor']],
        body: [
          ['Ambiente', historyItem.environment.toUpperCase()],
          ['Status', historyItem.status.toUpperCase()],
          ['Versão (Commit)', historyItem.commit],
          ['URL Pública', historyItem.pwaUrl],
          ['Health-Check', historyItem.healthStatus?.toUpperCase() || "N/A"],
          ['Comentário', historyItem.parameters.approvalComment || "N/A"],
          ['Modo', historyItem.parameters.dryRun ? "SIMULAÇÃO" : "REAL"]
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 102, 204] }
      });

      // Evidence Section
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("Evidências de Auditoria", 14, finalY);
      
      const evidenceData = detailedEvidence.map((e, idx) => [
        idx + 1,
        e.name,
        `${(e.size / 1024).toFixed(1)} KB`,
        e.scanResult.toUpperCase(),
        e.hash.substring(0, 16) + '...'
      ]);

      (autoTable as any)(doc, {
        startY: finalY + 5,
        head: [['#', 'Arquivo', 'Tamanho', 'Scan', 'Hash (SHA-256)']],
        body: evidenceData.length > 0 ? evidenceData : [['-', 'Nenhuma evidência', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50] }
      });

      // Append thumbnails/pages for images
      if (detailedEvidence.length > 0) {
        doc.addPage();
        doc.text("Anexos Incorporados (Visualização)", 14, 20);
        
        let currentImgY = 30;
        for (const e of detailedEvidence) {
          if (e.thumbnail || e.type.startsWith('image/')) {
            if (currentImgY > 250) {
              doc.addPage();
              currentImgY = 20;
            }
            doc.setFontSize(10);
            doc.text(`Anexo: ${e.name}`, 14, currentImgY);
            // Simulate adding thumbnail (placeholder box in PDF)
            doc.rect(14, currentImgY + 2, 40, 30);
            doc.setFontSize(8);
            doc.text("[Thumbnail Incorporada]", 16, currentImgY + 18);
            currentImgY += 45;
          }
        }
      }

      doc.save(`auditoria-deploy-${historyItem.commit}.pdf`);
      toast.success("PDF de Auditoria gerado com sucesso.");
      
      addAuditLog({
        action: "download_authorized",
        user: currentUserRole,
        attachmentName: `Relatório PDF (${historyItem.commit})`,
        reason: "Exportação de relatório de auditoria",
        status: "success"
      });
    } catch (error) {
      console.error("Audit PDF error:", error);
      toast.error("Erro ao gerar PDF de auditoria");
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesCommit = item.commit.toLowerCase().includes(historySearch.toLowerCase());
      const matchesUser = (item.user || "admin").toLowerCase().includes(historyUserSearch.toLowerCase());
      const matchesEnv = historyFilter === "all" || item.environment === historyFilter;
      const matchesStatus = historyStatusFilter === "all" || item.status === historyStatusFilter;
      return matchesCommit && matchesUser && matchesEnv && matchesStatus;
    });
  }, [history, historySearch, historyUserSearch, historyFilter, historyStatusFilter]);

  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHistory, currentPage]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-xl border-primary/20 shadow-2xl overflow-hidden">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] gap-1 px-2 py-0.5">
          <UserCheck className="h-2.5 w-2.5" /> {currentUserRole.toUpperCase()}
        </Badge>
        <Select value={currentUserRole} onValueChange={setCurrentUserRole}>
          <SelectTrigger className="w-[100px] h-6 text-[9px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="developer">Dev</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Hub de Deploy
            </h3>
            <p className="text-xs text-muted-foreground">PWA, APK e Gestão de Ambientes</p>
          </div>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="current" className="text-xs">Atual</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Histórico</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Settings className="h-3 w-3 mr-1.5" /> Políticas
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">
              <Shield className="h-3 w-3 mr-1.5" /> Auditoria
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="current" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4 bg-muted/30 p-4 rounded-xl border border-border/20">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Ambiente de Destino</span>
                  <Select 
                    value={environment} 
                    onValueChange={(v: any) => setEnvironment(v)}
                    disabled={isDeploying}
                  >
                    <SelectTrigger className="h-9 bg-background/50 border-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staging">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5" /> Staging (staging.kubovibe.app)
                        </div>
                      </SelectItem>
                      <SelectItem value="production">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Produção (kubovibe.app)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Dialog open={pendingApproval} onOpenChange={setPendingApproval}>
                    <DialogTrigger asChild>
                      <Button 
                        disabled={isDeploying || !canExecuteDeploy}
                        className={cn(
                          "h-9 shadow-lg",
                          environment === "production" ? "bg-primary hover:bg-primary/90" : "bg-primary shadow-primary/20"
                        )}
                      >
                        {isDeploying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 
                         isDryRun ? <Activity className="h-4 w-4 mr-2" /> :
                         <PlayCircle className="h-4 w-4 mr-2" />}
                        {isDeploying ? "Publicando..." : 
                         isDryRun ? "Simular Deploy" : "Deploy Agora"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <ShieldAlert className="h-5 w-5 text-primary" />
                          Aprovação de Deploy - {environment.toUpperCase()}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="p-3 bg-muted/50 rounded-lg border border-border/40 text-[11px] space-y-2">
                          <p className="font-bold flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5" /> Política de Segurança
                          </p>
                          <p>O deploy em {environment.toUpperCase()} exige justificativa, evidências e aceitação dos termos.</p>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-bold flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" /> Justificativa e Testes Realizados
                          </label>
                          <Textarea 
                            placeholder="Descreva as alterações e resultados dos testes manuais..."
                            value={approvalComment}
                            onChange={(e) => setApprovalComment(e.target.value)}
                            className="text-xs min-h-[80px]"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Paperclip className="h-3.5 w-3.5" /> Evidências (Prints/Logs)
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              Máx. {currentPolicy.maxSizeMB}MB | {currentPolicy.expirationDays} dias retenção
                            </span>
                          </label>
                          <div 
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files) {
                                setIsScanning(true);
                                const files = Array.from(e.dataTransfer.files);
                                for (const f of files) {
                                  // Content-type check and scan simulation
                                  if (f.size > maxEvidenceSize) {
                                    toast.error(`Arquivo ${f.name} excede o limite de ${currentPolicy.maxSizeMB}MB`);
                                    continue;
                                  }
                                  if (!allowedTypes.includes(f.type)) {
                                    toast.error(`Tipo ${f.type} não permitido pela política de segurança`);
                                    continue;
                                  }
                                  // Simulate Malware Scan
                                  await new Promise(r => setTimeout(r, 400));
                                  setEvidenceFiles(prev => [...prev, f]);
                                }
                                setIsScanning(false);
                              }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              "border-2 border-dashed border-border/60 rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 hover:border-primary/40 transition-all group relative",
                              isScanning && "opacity-50 pointer-events-none"
                            )}
                          >
                            <input 
                              type="file" 
                              multiple 
                              className="hidden" 
                              ref={fileInputRef}
                              onChange={async (e) => {
                                if (e.target.files) {
                                  setIsScanning(true);
                                  const files = Array.from(e.target.files);
                                  for (const f of files) {
                                    if (f.size <= maxEvidenceSize && allowedTypes.includes(f.type)) {
                                      await new Promise(r => setTimeout(r, 300));
                                      setEvidenceFiles(prev => [...prev, f]);
                                    } else {
                                      toast.error(`Validação falhou para ${f.name}`);
                                    }
                                  }
                                  setIsScanning(false);
                                }
                              }}
                            />
                            {isScanning ? (
                              <div className="flex flex-col items-center gap-1">
                                <Loader2 className="h-6 w-6 animate-spin text-primary mb-1" />
                                <p className="text-xs font-medium">Escaneando arquivos...</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
                                <p className="text-xs font-medium">Arraste ou clique para anexar</p>
                                <p className="text-[10px] text-muted-foreground font-normal">Varredura de malware automática ativa</p>
                              </div>
                            )}
                          </div>
                          {evidenceFiles.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {evidenceFiles.map((f, i) => (
                                <div key={i} className="flex flex-col bg-muted/30 p-2 rounded-md border border-border/40 animate-in fade-in slide-in-from-top-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {f.type.startsWith('image/') ? <Eye className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
                                      <span className="text-[9px] truncate max-w-[100px]">{f.name}</span>
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-4 w-4 hover:text-destructive" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEvidenceFiles(prev => prev.filter((_, idx) => idx !== i));
                                      }}
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[7px] h-3 px-1 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                                      CLEAN
                                    </Badge>
                                    <span className="text-[8px] text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>


                        <div className="flex items-start gap-2 pt-2">
                          <Checkbox 
                            id="terms" 
                            checked={approvalTerms}
                            onCheckedChange={(v) => setApprovalTerms(!!v)}
                            className="mt-0.5"
                          />
                          <label htmlFor="terms" className="text-[11px] leading-tight cursor-pointer">
                            Eu confirmo que validei as APIs, anexei evidências e assumo a responsabilidade por este deploy em {environment.toUpperCase()}.
                          </label>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="text-[11px] font-bold">Modo Dry-Run</span>
                          </div>
                          <Checkbox 
                            checked={isDryRun}
                            onCheckedChange={(v) => setIsDryRun(!!v)}
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingApproval(false)}>Cancelar</Button>
                        <Button 
                          onClick={() => runValidation()}
                          disabled={environment === "production" && (!approvalComment.trim() || !approvalTerms)}
                        >
                          Confirmar e Iniciar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                {!canExecuteDeploy ? (
                  <div className="flex items-center gap-2 text-[10px] text-destructive font-bold p-2 bg-destructive/10 rounded-lg flex-1 mr-4">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Seu cargo ({currentUserRole}) não permite deploy em {environment.toUpperCase()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-primary font-bold p-2 bg-primary/5 rounded-lg flex-1 mr-4">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Acesso autorizado para {environment.toUpperCase()}
                  </div>
                )}
                
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Simulação</span>
                    <Checkbox checked={isDryRun} onCheckedChange={(v) => setIsDryRun(!!v)} />
                  </div>
                  {activeDeploys.length > 0 && (
                    <Badge variant="destructive" className="animate-pulse gap-1 text-[9px]">
                      <Cpu className="h-2.5 w-2.5" /> DEPLOY CONCORRENTE ATIVO
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border border-border/20 space-y-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                <Bell className="h-3 w-3" /> Notificações
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="notify-email" className="text-xs flex items-center gap-2 cursor-pointer">
                    <Mail className="h-3.5 w-3.5" /> E-mail
                  </label>
                  <Checkbox 
                    id="notify-email" 
                    checked={notifications.email} 
                    onCheckedChange={(v) => setNotifications(p => ({ ...p, email: !!v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label htmlFor="notify-webhook" className="text-xs flex items-center gap-2 cursor-pointer">
                    <Code className="h-3.5 w-3.5" /> Webhook (Slack)
                  </label>
                  <Checkbox 
                    id="notify-webhook" 
                    checked={notifications.webhook} 
                    onCheckedChange={(v) => setNotifications(p => ({ ...p, webhook: !!v }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                <span>Progresso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              <div className="space-y-2">
                {steps.map((step) => (
                  <div key={step.id} className={cn(
                    "p-3 rounded-lg border flex items-center gap-3 transition-colors",
                    step.status === "validating" ? "border-primary/50 bg-primary/5" : "border-border/40"
                  )}>
                    {step.status === "success" ? <Check className="h-4 w-4 text-green-500" /> :
                     step.status === "validating" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
                     step.status === "error" ? <X className="h-4 w-4 text-destructive" /> :
                     <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />}
                    <div className="flex-1">
                      <p className="text-xs font-bold">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-none">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/20 bg-black/40 p-4 flex flex-col h-[300px]">
              <div className="flex items-center gap-2 mb-3 text-primary">
                <Terminal className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold">Logs em Tempo Real</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1.5 font-mono text-[10px]">
                  {logs.length === 0 && <p className="text-muted-foreground italic">Aguardando início do deploy...</p>}
                  {logs.map((log, i) => (
                    <div key={i} className={cn(
                      "flex gap-2 animate-in fade-in slide-in-from-left-1",
                      log.level === "error" ? "text-destructive" :
                      log.level === "success" ? "text-green-500" :
                      "text-muted-foreground"
                    )}>
                      <span className="opacity-50 shrink-0">[{log.timestamp}]</span>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {progress === 100 && !isDeploying && (
            <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 animate-in zoom-in-95">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Publicado com Sucesso!</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Conexão HTTPS ativa e segura
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog open={showQR} onOpenChange={setShowQR}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-2">
                        <QrCode className="h-3.5 w-3.5" /> QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xs text-center">
                      <DialogHeader>
                        <DialogTitle>Acesso Instantâneo</DialogTitle>
                      </DialogHeader>
                      <div className="bg-white p-4 rounded-lg mx-auto">
                         <div className="w-48 h-48 bg-gray-200 flex items-center justify-center border-2 border-dashed">
                           <QrCode className="h-12 w-12 text-gray-400" />
                         </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Escaneie para abrir o PWA</p>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" className="h-8 gap-2" asChild>
                    <a href="https://kubovibe.app" target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver Site
                    </a>
                  </Button>
                  <Button size="sm" className="h-8 gap-2 bg-green-600 hover:bg-green-700">
                    <Download className="h-3.5 w-3.5" /> Baixar APK
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Commit..." 
                className="pl-9 h-9 text-xs"
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="relative">
              <UserCheck className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Usuário..." 
                className="pl-9 h-9 text-xs"
                value={historyUserSearch}
                onChange={(e) => { setHistoryUserSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <Select value={historyFilter} onValueChange={(v) => { setHistoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-xs">
                <Filter className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Ambiente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Ambientes</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyStatusFilter} onValueChange={(v) => { setHistoryStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-xs">
                <Activity className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Falha</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredHistory.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Nenhum deploy encontrado</p>
                </div>
              )}
              {paginatedHistory.map((item) => (
                <div key={item.id} className={cn(
                  "p-4 rounded-xl border transition-colors",
                  item.status === "blocked" ? "border-destructive/30 bg-destructive/5" : "border-border/20 bg-muted/20 hover:bg-muted/30"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.environment === "production" ? "default" : "outline"} className="text-[9px] h-4">
                        {item.environment.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">#{item.commit}</span>
                      {item.status === "blocked" && (
                        <Badge variant="destructive" className="text-[8px] h-3 px-1">BLOQUEADO</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(item.date).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        item.status === "success" ? "bg-green-500/10" : "bg-destructive/10"
                      )}>
                        {item.status === "success" ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {item.status === "success" ? "Deploy realizado com sucesso" : 
                             item.status === "blocked" ? "Tentativa de deploy bloqueada" : "Deploy falhou"}
                            {item.parameters.dryRun && <Badge variant="outline" className="ml-2 text-[8px] h-3 border-orange-500 text-orange-500">DRY-RUN</Badge>}
                          </span>
                          <span className="text-[9px] text-muted-foreground italic flex items-center gap-1">
                            por <UserCheck className="h-2.5 w-2.5" /> {item.user || "admin"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.failedStepId && (
                            <span className="text-[10px] text-destructive font-medium">
                              Falha na etapa: {steps.find(s => s.id === item.failedStepId)?.label}
                            </span>
                          )}
                          {item.healthStatus && item.healthStatus !== "unchecked" && (
                            <Badge variant={item.healthStatus === "up" ? "outline" : "destructive"} className="text-[8px] h-3 gap-1">
                              {item.healthStatus === "up" ? <Check className="h-2 w-2" /> : <X className="h-2 w-2" />}
                              HEALTH: {item.healthStatus.toUpperCase()}
                            </Badge>
                          )}
                          {item.parameters.approvalComment && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                              <MessageSquare className="h-2.5 w-2.5" /> {item.parameters.approvalComment.substring(0, 30)}...
                            </span>
                          )}
                          {item.evidence && item.evidence.length > 0 && (
                            <span className="text-[9px] text-primary flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded">
                              <Paperclip className="h-2.5 w-2.5" /> {item.evidence.length} evidências
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[10px]">
                            <Eye className="h-3.5 w-3.5" /> Revisar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Detalhes da Execução #{item.commit}</DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-2 gap-4 py-4">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Ambiente & Status</p>
                                <div className="flex items-center gap-2">
                                  <Badge>{item.environment.toUpperCase()}</Badge>
                                  <Badge variant={item.status === "success" ? "outline" : "destructive"}>{item.status.toUpperCase()}</Badge>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Responsável</p>
                                <p className="text-xs font-mono">{item.user || "admin"}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Justificativa</p>
                                <p className="text-xs italic bg-muted p-2 rounded border">{item.parameters.approvalComment || "Nenhuma justificativa fornecida"}</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Health Check</p>
                                <p className="text-xs">{item.healthDetails || "Não executado"}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Resumo dos Anexos ({item.evidence?.length || 0})</p>
                                <div className="space-y-1.5">
                                  {((item as any).detailedEvidence as EvidenceFile[])?.map((f, idx) => (
                                    <div key={idx} className="group relative flex flex-col gap-1 bg-muted/40 p-2 rounded border border-border/40 hover:border-primary/40 transition-colors">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                          {f.type.startsWith('image/') ? <Eye className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
                                          <span className="text-[10px] font-bold truncate max-w-[140px]">{f.name}</span>
                                        </div>
                                        <Badge variant={f.scanResult === "clean" ? "outline" : "destructive"} className="text-[8px] h-3.5 px-1 bg-background">
                                          {f.scanResult.toUpperCase()}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 border-t border-border/20 pt-1">
                                        <div className="flex flex-col">
                                          <span className="text-[7px] text-muted-foreground uppercase">Tamanho</span>
                                          <span className="text-[9px] font-mono">{(f.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[7px] text-muted-foreground uppercase">Tipo Detectado</span>
                                          <span className="text-[9px] truncate" title={f.type}>{f.type.split('/')[1]?.toUpperCase() || 'BIN'}</span>
                                        </div>
                                        <div className="flex flex-col col-span-2">
                                          <span className="text-[7px] text-muted-foreground uppercase">Hash (SHA-256)</span>
                                          <span className="text-[8px] font-mono truncate opacity-60">
                                            {f.hash}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-border/10">
                                        <p className="text-[8px] text-muted-foreground italic">
                                          Link assinado para Dev/Admin
                                        </p>
                                        <Button 
                                          variant="secondary" 
                                          size="sm" 
                                          className="h-6 px-2 text-[9px] gap-1 hover:bg-primary hover:text-primary-foreground transition-all" 
                                          onClick={() => {
                                            const isAdmin = currentUserRole === 'admin';
                                            const isDev = currentUserRole === 'developer';
                                            const isApprover = item.user === currentUserRole; 
                                            const reason = isAdmin ? "Acesso administrativo (Admin)" : isDev ? "Acesso de desenvolvedor (Dev)" : isApprover ? "Aprovador original da execução" : "Acesso não autorizado";

                                            if (!isAdmin && !isDev && !isApprover) {
                                              addAuditLog({
                                                action: "download_denied",
                                                user: currentUserRole,
                                                attachmentName: f.name,
                                                reason,
                                                status: "denied"
                                              });
                                              toast.error("Acesso Negado", { description: "Apenas Dev, Admin ou o Aprovador original podem baixar esta evidência." });
                                              return;
                                            }

                                            // Check expiration from URL for simulation
                                            const urlParams = new URLSearchParams(f.url.split('?')[1]);
                                            const expires = parseInt(urlParams.get('expires') || '0');
                                            if (Date.now() > expires) {
                                              addAuditLog({
                                                action: "download_denied",
                                                user: currentUserRole,
                                                attachmentName: f.name,
                                                reason: "Link assinado expirado",
                                                status: "denied"
                                              });
                                              toast.error("Link Expirado", { description: "O link assinado para esta evidência expirou por segurança." });
                                              return;
                                            }
                                            
                                            addAuditLog({
                                              action: "download_authorized",
                                              user: currentUserRole,
                                              attachmentName: f.name,
                                              reason,
                                              status: "success"
                                            });
                                            toast.success("Download iniciado", { description: `Arquivo: ${f.name} via link temporário assinado.` });
                                            window.open(f.url, '_blank');
                                          }}
                                        >
                                          <Download className="h-2.5 w-2.5" /> Baixar
                                        </Button>
                                      </div>
                                    </div>
                                  )) || <span className="text-[10px] text-muted-foreground">Nenhuma evidência anexada</span>}
                                </div>

                                {/* Histórico de auditoria de downloads desta revisão */}
                                <div className="mt-4 border-t border-border/30 pt-3">
                                  <h4 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                                    <FileBadge className="h-3 w-3 text-primary" />
                                    Histórico de Auditoria de Downloads
                                  </h4>
                                  <AuditHistoryManager 
                                    logs={auditLogs}
                                    userRole={currentUserRole}
                                    originalApprover={item.user}
                                    showFilters={false}
                                    filterByAttachment={undefined} 
                                    onAuditLog={addAuditLog}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <DialogFooter className="sm:justify-start">
                            <Button variant="outline" size="sm" onClick={() => downloadAuditSummary(item)}>
                              <FileBadge className="h-3.5 w-3.5 mr-2" /> PDF Auditoria
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {item.status === "error" && item.failedStepId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-1.5 text-xs text-primary"
                          onClick={() => {
                            setEnvironment(item.parameters.environment);
                            setNotifications(item.parameters.notifications);
                            setCurrentCommit(item.parameters.commit);
                            setActiveTab("current");
                            runValidation(item.failedStepId, item.logs, item.parameters.commit);
                          }}
                        >
                          <RotateCcw className="h-3 w-3" /> Retomar
                        </Button>

                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Exportar Logs">
                            <FileJson className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Exportar Logs e Auditoria</DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-1 gap-4 py-4">
                            <Button variant="outline" className="justify-start gap-2" onClick={() => downloadLogs(item, "json")}>
                              <FileJson className="h-4 w-4 text-orange-500" /> Baixar em JSON
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => downloadLogs(item, "csv")}>
                              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Baixar em CSV
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => downloadAuditSummary(item)}>
                              <FileBadge className="h-4 w-4 text-blue-500" /> Relatório de Auditoria Completo (PDF/TXT)
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ver PWA">
                        <a href={item.pwaUrl} target="_blank"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Baixar APK">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {retentionPolicies.map((policy, idx) => (
              <Card key={policy.environment} className="p-4 border-primary/10 bg-muted/10 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className={cn("h-4 w-4", policy.environment === "production" ? "text-primary" : "text-muted-foreground")} />
                    <h4 className="text-sm font-bold uppercase">{policy.environment}</h4>
                  </div>
                  <Badge variant={policy.environment === "production" ? "default" : "outline"}>
                    Configuração Ativa
                  </Badge>
                </div>
                
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-xs font-medium flex items-center gap-2">
                        <Package className="h-3.5 w-3.5" /> Tamanho Máximo (MB)
                      </label>
                      <span className="text-xs font-bold text-primary">{policy.maxSizeMB} MB</span>
                    </div>
                    <Slider 
                      value={[policy.maxSizeMB]} 
                      max={100} 
                      step={5}
                      onValueChange={([val]) => {
                        const newPolicies = [...retentionPolicies];
                        newPolicies[idx].maxSizeMB = val;
                        setRetentionPolicies(newPolicies);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-xs font-medium flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" /> Expiração (Dias)
                      </label>
                      <span className="text-xs font-bold text-primary">{policy.expirationDays} dias</span>
                    </div>
                    <Slider 
                      value={[policy.expirationDays]} 
                      max={90} 
                      step={1}
                      onValueChange={([val]) => {
                        const newPolicies = [...retentionPolicies];
                        newPolicies[idx].expirationDays = val;
                        setRetentionPolicies(newPolicies);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/40">
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold">Auto-Exclusão</p>
                      <p className="text-[9px] text-muted-foreground">Excluir anexos após expiração</p>
                    </div>
                    <Switch 
                      checked={policy.autoDelete}
                      onCheckedChange={(checked) => {
                        const newPolicies = [...retentionPolicies];
                        newPolicies[idx].autoDelete = checked;
                        setRetentionPolicies(newPolicies);
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                  <p className="text-[10px] font-bold flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-primary" /> Lovable Security Guard
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight">
                    Varredura de malware ativa para todos os uploads. Regras validadas antes de aceitar novos anexos. 
                    Limite total de armazenamento para {policy.environment.toUpperCase()} é dinâmico.
                  </p>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="p-4 rounded-xl border border-border/20 bg-muted/20 flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Monitoramento de Armazenamento
              </h4>
              <p className="text-xs text-muted-foreground">Uso total de anexos em todos os ambientes: 142.5 MB</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.success("Política de retenção sincronizada")}>
              Aplicar em Tudo
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="audit" className="mt-0 space-y-4">
          <Card className="p-4 border-primary/10 bg-muted/10">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold uppercase">Log de Auditoria de Acessos</h4>
              </div>
              <Badge variant="outline" className="text-[10px]">Últimas 100 atividades</Badge>
            </div>
            
            <AuditHistoryManager 
              logs={auditLogs}
              userRole={currentUserRole}
              title="Relatório Geral de Auditoria de Acessos"
              onAuditLog={addAuditLog}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
