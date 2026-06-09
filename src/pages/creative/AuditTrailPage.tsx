import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, Search, FileDown, ArrowUpDown, Loader2, X, Filter, 
  AlertTriangle, Save, History, ChevronRight, Info, AlertCircle, Share2, TrendingUp, Clock,
  Layers, Copy, ArrowLeftRight
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type AuditTrail = {
  id: string;
  user_id: string;
  step: string;
  action: string;
  params: any;
  correlation_id: string | null;
  trace_id: string | null;
  created_at: string;
  user_email?: string;
};

const PAGE_SIZE = 25;

export default function CreativeAuditPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [step, setStep] = useState(searchParams.get("step") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [startDate, setStartDate] = useState(searchParams.get("start") || "");
  const [endDate, setEndDate] = useState(searchParams.get("end") || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("sort") as "asc" | "desc") || "desc");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [selectedEntry, setSelectedEntry] = useState<AuditTrail | null>(null);
  const [compareEntries, setCompareEntries] = useState<AuditTrail[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState<AuditTrail[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [savedFilters, setSavedFilters] = useState<any[]>(() => {
    const saved = localStorage.getItem("creative_audit_filters");
    return saved ? JSON.parse(saved) : [];
  });
  const [recurrenceThreshold, setRecurrenceThreshold] = useState(() => {
    const saved = localStorage.getItem("creative_audit_recurrence_threshold");
    return saved ? Number(saved) : 2;
  });
  const [expandedCorrelations, setExpandedCorrelations] = useState<Set<string>>(new Set());

  // Update URL params when filters change
  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (step !== "all") params.step = step;
    if (status !== "all") params.status = status;
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    if (sortDir !== "desc") params.sort = sortDir;
    if (page !== 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, step, status, startDate, endDate, sortDir, page, setSearchParams]);

  const debouncedSearch = useDebounce(search, 500);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["creative-audit-trail", user?.id, debouncedSearch, step, status, startDate, endDate, sortDir, page],
    queryFn: async () => {
      if (!user) throw new Error("Não autenticado");

      let q = supabase
        .from("creative_audit_trail")
        .select("*, users!creative_audit_trail_user_id_fkey(email)", { count: "exact" });

      if (step !== "all") q = q.eq("step", step);
      
      if (status !== "all") {
        if (status === "failed") {
          q = q.or('action.ilike.%failed%,action.ilike.%error%,params->>error.not.is.null');
        } else if (status === "success") {
          q = q.not('action', 'ilike', '%failed%').not('action', 'ilike', '%error%');
        }
      }

      if (debouncedSearch) {
        // Search in correlation_id, trace_id, action, or params (stringified)
        q = q.or(`correlation_id.ilike.%${debouncedSearch}%,trace_id.ilike.%${debouncedSearch}%,action.ilike.%${debouncedSearch}%`);
      }

      if (startDate) q = q.gte("created_at", startDate);
      if (endDate) q = q.lte("created_at", endDate + "T23:59:59");

      q = q.order("created_at", { ascending: sortDir === "asc" });
      q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) throw error;

      return {
        entries: (data as any[]).map(d => ({
          ...d,
          user_email: d.users?.email
        })) as AuditTrail[],
        count: count ?? 0
      };
    },
    enabled: !!user,
  });

  const entries = data?.entries || [];
  const count = data?.count || 0;
  const totalPages = Math.ceil(count / PAGE_SIZE);

  // Recurrent failures summary
  const recurrentFailures = useMemo(() => {
    const failures: Record<string, { count: number; lastTrace: string; lastCorrelation: string; dates: string[] }> = {};
    entries.forEach(entry => {
      const isError = entry.action.toLowerCase().includes("failed") || entry.action.toLowerCase().includes("error") || entry.params?.error;
      if (isError) {
        const key = entry.params?.error?.message || entry.action;
        if (!failures[key]) failures[key] = { count: 0, lastTrace: "", lastCorrelation: "", dates: [] };
        failures[key].count++;
        failures[key].lastTrace = entry.trace_id || "";
        failures[key].lastCorrelation = entry.correlation_id || "";
        failures[key].dates.push(entry.created_at);
      }
    });
    return Object.entries(failures)
      .filter(([_, v]) => v.count >= recurrenceThreshold)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
  }, [entries, recurrenceThreshold]);

  // Detected retries for alert indicators in table
  const retryCountByCorrelation = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(entry => {
      if (entry.correlation_id) {
        counts[entry.correlation_id] = (counts[entry.correlation_id] || 0) + 1;
      }
    });
    return counts;
  }, [entries]);

  const toggleComparison = (entry: AuditTrail) => {
    setCompareEntries(prev => {
      const exists = prev.find(e => e.id === entry.id);
      if (exists) return prev.filter(e => e.id !== entry.id);
      if (prev.length >= 2) {
        toast.warning("Selecione apenas 2 eventos para comparar");
        return prev;
      }
      return [...prev, entry];
    });
  };

  const startComparison = () => {
    if (compareEntries.length !== 2) {
      toast.error("Selecione exatamente 2 eventos para comparar");
      return;
    }
    setIsComparing(true);
  };

  // Failure Trends Data for Chart
  const failureTrends = useMemo(() => {
    const dailyData: Record<string, Record<string, number>> = {};
    entries.forEach(entry => {
      const isError = entry.action.toLowerCase().includes("failed") || entry.action.toLowerCase().includes("error") || entry.params?.error;
      if (isError) {
        const date = new Date(entry.created_at).toLocaleDateString();
        const key = (entry.params?.error?.message || entry.action).slice(0, 20) + "...";
        if (!dailyData[date]) dailyData[date] = {};
        dailyData[date][key] = (dailyData[date][key] || 0) + 1;
      }
    });

    return Object.entries(dailyData).map(([date, counts]) => ({
      date,
      ...counts
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entries]);

  // Group entries by correlation_id for the UI list
  const groupedEntries = useMemo(() => {
    const cidMap: Record<string, AuditTrail[]> = {};
    const flat: (AuditTrail & { isGroup?: boolean; children?: AuditTrail[] })[] = [];

    entries.forEach(entry => {
      if (entry.correlation_id) {
        if (!cidMap[entry.correlation_id]) cidMap[entry.correlation_id] = [];
        cidMap[entry.correlation_id].push(entry);
      } else {
        flat.push(entry);
      }
    });

    // For each group, the representative is the most recent one
    Object.keys(cidMap).forEach(cid => {
      const sorted = [...cidMap[cid]].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      flat.push({
        ...sorted[0],
        isGroup: sorted.length > 1,
        children: sorted
      });
    });

    return flat.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [entries]);

  // Multiple attempts detection
  const multipleAttempts = useMemo(() => {
    return Object.values(retryCountByCorrelation).filter(v => v > 1).length;
  }, [retryCountByCorrelation]);

  const saveRecurrenceThreshold = () => {
    localStorage.setItem("creative_audit_recurrence_threshold", String(recurrenceThreshold));
    toast.success(`Limite de recorrência padrão salvo como ${recurrenceThreshold}`);
  };

  const toggleCorrelationExpansion = (cid: string) => {
    const next = new Set(expandedCorrelations);
    if (next.has(cid)) next.delete(cid);
    else next.add(cid);
    setExpandedCorrelations(next);
  };

  const exportComparison = (format: "json" | "csv") => {
    if (compareEntries.length !== 2) return;
    
    const content = format === "json" 
      ? JSON.stringify({ comparison: compareEntries, timestamp: new Date().toISOString() }, null, 2)
      : [
          ["ID", "Step", "Action", "Correlation", "Params"],
          ...compareEntries.map(e => [e.id, e.step, e.action, e.correlation_id || "", JSON.stringify(e.params)])
        ].map(row => row.join(",")).join("\n");

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-comparison-${Date.now()}.${format}`;
    link.click();
    toast.success("Comparação exportada");
  };

  const getDiffProbableCauses = () => {
    if (compareEntries.length !== 2) return [];
    const [a, b] = compareEntries;
    const causes = [];
    
    if (JSON.stringify(a.params) !== JSON.stringify(b.params)) {
      causes.push("Diferença nos parâmetros de entrada detectada.");
    }
    if (a.step !== b.step) {
      causes.push("Eventos ocorridos em etapas diferentes do fluxo.");
    }
    if (a.params?.error && b.params?.error && a.params.error.message !== b.params.error.message) {
      causes.push("Mensagens de erro distintas sugerem falhas em sub-processos diferentes.");
    }
    
    return causes.length > 0 ? causes : ["Padrões técnicos idênticos - possível falha intermitente de ambiente."];
  };

  const loadTimeline = async (correlationId: string) => {
    setIsTimelineLoading(true);
    try {
      const { data, error } = await supabase
        .from("creative_audit_trail")
        .select("*")
        .eq("correlation_id", correlationId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      setTimelineEntries(data || []);
    } catch (err) {
      toast.error("Erro ao carregar linha do tempo");
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const shareCurrentView = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link da consulta copiado!");
  };

  const saveCurrentFilters = () => {
    const newFilter = {
      id: Date.now(),
      name: `Busca ${new Date().toLocaleTimeString()}`,
      filters: { search, step, status, startDate, endDate }
    };
    const updated = [newFilter, ...savedFilters].slice(0, 5);
    setSavedFilters(updated);
    localStorage.setItem("creative_audit_filters", JSON.stringify(updated));
    toast.success("Filtros salvos localmente");
  };

  const applySavedFilter = (f: any) => {
    setSearch(f.filters.search);
    setStep(f.filters.step);
    setStatus(f.filters.status);
    setStartDate(f.filters.startDate);
    setEndDate(f.filters.endDate);
    setPage(1);
    toast.info(`Filtro "${f.name}" aplicado`);
  };

  const exportData = (format: "json" | "csv") => {
    if (entries.length === 0) return toast.error("Sem dados para exportar");
    
    const filename = `creative-audit-filtered-${new Date().toISOString()}.${format}`;
    let content: string;
    let mime: string;

    if (format === "json") {
      content = JSON.stringify(entries, null, 2);
      mime = "application/json";
    } else {
      const headers = ["ID", "User", "Step", "Action", "Correlation ID", "Trace ID", "Created At", "Params"];
      const rows = entries.map(e => [
        e.id,
        e.user_email || e.user_id,
        e.step,
        e.action,
        e.correlation_id || "",
        e.trace_id || "",
        e.created_at,
        JSON.stringify(e.params).replace(/"/g, '""')
      ].map(v => `"${v}"`).join(","));
      
      content = [headers.join(","), ...rows].join("\n");
      mime = "text/csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportado (${entries.length} registros filtrados)`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/creative")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Painel
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Trilha de Auditoria</h1>
          <p className="text-muted-foreground mt-1">
            Consulte o histórico técnico de execuções e eventos do painel criativo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportData("json")}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar JSON
          </Button>
          <Button variant="outline" onClick={() => exportData("csv")}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Alerts & Insights */}
        {(recurrentFailures.length > 0 || multipleAttempts > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {recurrentFailures.length > 0 && (
              <Card className="p-4 border-destructive/20 bg-destructive/5 lg:col-span-1">
                <div className="flex items-center gap-2 mb-3 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <h3 className="font-semibold">Falhas Recorrentes</h3>
                </div>
                <div className="space-y-2">
                  {recurrentFailures.map(([cause, info]) => (
                    <div key={cause} className="text-sm flex justify-between items-start bg-background/50 p-2 rounded">
                      <span className="line-clamp-2 flex-1 font-mono text-xs">{cause}</span>
                      <Badge variant="destructive" className="ml-2">{info.count}x</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            
            {failureTrends.length > 1 && (
              <Card className="p-4 lg:col-span-1">
                <div className="flex items-center gap-2 mb-3 text-primary">
                  <TrendingUp className="h-5 w-5" />
                  <h3 className="font-semibold">Tendência de Falhas</h3>
                </div>
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={failureTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                        itemStyle={{ fontSize: '10px' }}
                      />
                      {Object.keys(failureTrends[0] || {}).filter(k => k !== 'date').map((key, i) => (
                        <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${i * 137.5}, 70%, 50%)`} dot={false} strokeWidth={2} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {multipleAttempts > 0 && (
              <Card className="p-4 border-yellow-500/20 bg-yellow-500/5 lg:col-span-1">
                <div className="flex items-center gap-2 mb-3 text-yellow-600">
                  <History className="h-5 w-5" />
                  <h3 className="font-semibold">Alerta de Retries</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Identificamos <strong>{multipleAttempts}</strong> IDs com múltiplas tentativas.
                </p>
                <Button variant="outline" size="sm" onClick={() => setSearch("retry")}>
                  Investigar Retries
                </Button>
              </Card>
            )}
          </div>
        )}

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="ID, Correlation, Trace ou Ação..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={step} onValueChange={(v) => { setStep(v); setPage(1); }}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etapas</SelectItem>
                <SelectItem value="Selection">Seleção</SelectItem>
                <SelectItem value="Config">Configuração</SelectItem>
                <SelectItem value="Execution">Execução</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger>
                <AlertTriangle className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falhas / Erros</SelectItem>
              </SelectContent>
            </Select>
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2 bg-accent/20 px-3 py-1 rounded-full border">
              <span className="text-xs font-medium">Limite de Recorrência:</span>
              <input 
                type="number" 
                min="1" 
                value={recurrenceThreshold}
                onChange={(e) => setRecurrenceThreshold(Number(e.target.value))}
                className="w-12 bg-transparent text-xs font-bold border-none focus:ring-0"
              />
              <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={saveRecurrenceThreshold} title="Salvar como padrão">
                <Save className="h-3 w-3" />
              </Button>
            </div>
            {recurrentFailures.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs h-8"
                onClick={() => setSearch(recurrentFailures[0][0])}
              >
                <Layers className="h-3 w-3 mr-1" /> Ver falhas mais recorrentes
              </Button>
            )}
            {compareEntries.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs font-medium">{compareEntries.length}/2 selecionados</span>
                <Button size="sm" className="h-8" disabled={compareEntries.length !== 2} onClick={startComparison}>
                  <ArrowLeftRight className="h-3 w-3 mr-1" /> Comparar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setCompareEntries([])}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={saveCurrentFilters}>
                <Save className="h-4 w-4 mr-2" /> Salvar Busca
              </Button>
              <Button variant="outline" size="sm" onClick={shareCurrentView}>
                <Share2 className="h-4 w-4 mr-2" /> Compartilhar Link
              </Button>
              {savedFilters.length > 0 && (
                <div className="flex gap-1">
                  {savedFilters.map((f: any) => (
                    <Badge 
                      key={f.id} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => applySavedFilter(f)}
                    >
                      {f.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {(debouncedSearch || step !== "all" || status !== "all" || startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch(""); setStep("all"); setStatus("all"); setStartDate(""); setEndDate(""); setPage(1);
              }}>
                <X className="h-4 w-4 mr-2" /> Limpar Filtros
              </Button>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">
                    <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} className="flex items-center gap-1 hover:text-foreground">
                      Data <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Correlation / Trace ID</TableHead>
                  <TableHead className="text-center">Comparar</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Nenhum registro encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedEntries.map((entry) => {
                    const retries = entry.correlation_id ? retryCountByCorrelation[entry.correlation_id] : 0;
                    const isSelectedForCompare = !!compareEntries.find(e => e.id === entry.id);
                    const isExpanded = entry.correlation_id && expandedCorrelations.has(entry.correlation_id);
                    
                    return (
                      <>
                        <TableRow 
                          key={entry.id} 
                          className={`cursor-pointer transition-colors ${isSelectedForCompare ? 'bg-primary/10' : 'hover:bg-muted/50'} ${entry.isGroup ? 'bg-accent/5' : ''}`}
                          onClick={() => entry.isGroup ? toggleCorrelationExpansion(entry.correlation_id!) : setSelectedEntry(entry)}
                        >
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-2">
                              {entry.isGroup && (
                                <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              )}
                              {new Date(entry.created_at).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]" title={entry.user_email}>
                            {entry.user_email || "Usuário não identificado"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.step}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {entry.action}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                {entry.correlation_id && (
                                  <span className="text-[10px] text-muted-foreground">C: {entry.correlation_id}</span>
                                )}
                                {retries > 1 && (
                                  <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                    {retries}x tentativas
                                  </Badge>
                                )}
                              </div>
                              {entry.trace_id && (
                                <span className="text-[10px] text-muted-foreground">T: {entry.trace_id}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant={isSelectedForCompare ? "default" : "ghost"} 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleComparison(entry);
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        
                        {isExpanded && entry.children && entry.children.slice(1).map(child => (
                          <TableRow 
                            key={child.id} 
                            className="bg-accent/5 hover:bg-muted/30 border-l-2 border-l-primary/30"
                            onClick={() => setSelectedEntry(child)}
                          >
                            <TableCell className="pl-8 text-[10px] font-medium opacity-70">
                              {new Date(child.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-[10px] opacity-70 truncate max-w-[150px]">
                              {child.user_email || "---"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="ghost" className="text-[10px] h-4">{child.step}</Badge>
                            </TableCell>
                            <TableCell className="text-[10px] font-mono opacity-70">
                              {child.action}
                            </TableCell>
                            <TableCell>
                              <span className="text-[10px] opacity-50">T: {child.trace_id}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant={!!compareEntries.find(e => e.id === child.id) ? "default" : "ghost"} 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComparison(child);
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <ChevronRight className="h-3 w-3 ml-auto opacity-30" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {entries.length} de {count} registros
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    className="cursor-pointer"
                    onClick={() => page > 1 && setPage(page - 1)}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum = page;
                  if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;

                  if (pageNum <= 0 || pageNum > totalPages) return null;

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        className="cursor-pointer"
                        isActive={page === pageNum}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext 
                    className="cursor-pointer"
                    onClick={() => page < totalPages && setPage(page + 1)}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </main>

      {/* Details Side Panel */}
      <Sheet open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Detalhes do Evento
            </SheetTitle>
            <SheetDescription>
              Informações técnicas registradas para esta etapa.
            </SheetDescription>
          </SheetHeader>
          
          {selectedEntry && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Etapa</p>
                  <Badge>{selectedEntry.step}</Badge>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Data/Hora</p>
                  <p className="text-sm">{new Date(selectedEntry.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-1 p-3 bg-muted rounded-md border">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Ação</p>
                <p className="text-sm font-mono break-all">{selectedEntry.action}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center border-b pb-1">
                  <h4 className="text-sm font-semibold">Identificadores</h4>
                  {selectedEntry.correlation_id && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px]"
                      onClick={() => loadTimeline(selectedEntry.correlation_id!)}
                    >
                      <Clock className="h-3 w-3 mr-1" /> Ver Linha do Tempo
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Correlation ID:</span>
                    <code className="bg-accent px-1 rounded">{selectedEntry.correlation_id || "N/A"}</code>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Trace ID:</span>
                    <code className="bg-accent px-1 rounded">{selectedEntry.trace_id || "N/A"}</code>
                  </div>
                </div>
              </div>

              {/* Timeline Section */}
              {timelineEntries.length > 0 && (
                <div className="space-y-3 bg-accent/20 p-3 rounded-md border border-accent">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Histórico de Correlação
                  </h4>
                  <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-muted-foreground/30">
                    {timelineEntries.map((te, i) => (
                      <div key={te.id} className="relative pl-6 text-xs">
                        <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 bg-background z-10 ${
                          te.action.toLowerCase().includes('fail') ? 'border-destructive' : 'border-primary'
                        }`} />
                        <p className="font-bold opacity-70">{new Date(te.created_at).toLocaleTimeString()}</p>
                        <p className="font-mono text-[10px] truncate">{te.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold border-b pb-1">Parâmetros / Stack</h4>
                <div className="bg-black/95 text-green-400 p-4 rounded-md overflow-x-auto font-mono text-xs max-h-[300px]">
                  <pre>{JSON.stringify(selectedEntry.params, null, 2)}</pre>
                </div>
              </div>
              
              {selectedEntry.params?.error && (
                <div className="p-3 border border-destructive/50 bg-destructive/5 rounded-md">
                  <p className="text-xs font-bold text-destructive uppercase mb-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Causa Detectada
                  </p>
                  <p className="text-sm text-destructive font-medium">
                    {selectedEntry.params.error.message || "Erro desconhecido"}
                  </p>
                  {selectedEntry.params.error.stack && (
                    <details className="mt-2">
                      <summary className="text-[10px] cursor-pointer hover:underline text-destructive/80">Ver stack trace</summary>
                      <pre className="mt-1 text-[10px] opacity-70 whitespace-pre-wrap">{selectedEntry.params.error.stack}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Comparison Modal */}
      <Sheet open={isComparing} onOpenChange={() => setIsComparing(false)}>
        <SheetContent className="sm:max-w-5xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" /> Comparação Técnica Avançada
              </SheetTitle>
              <div className="flex gap-2 mr-6">
                <Button variant="outline" size="sm" onClick={() => exportComparison("json")}>
                  <FileDown className="h-3 w-3 mr-1" /> JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportComparison("csv")}>
                  <FileDown className="h-3 w-3 mr-1" /> CSV
                </Button>
              </div>
            </div>
            <SheetDescription>
              Comparação detalhada com destaque de discrepâncias de parâmetros e causas prováveis.
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 p-4 bg-primary/5 rounded-md border border-primary/20">
            <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4" /> Causas Prováveis da Divergência
            </h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              {getDiffProbableCauses().map((cause, i) => (
                <li key={i}>{cause}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            {compareEntries.map((entry, idx) => {
              const other = compareEntries[idx === 0 ? 1 : 0];
              
              return (
                <div key={entry.id} className="space-y-6">
                  <div className="p-3 bg-accent/20 rounded-md border flex justify-between items-center">
                    <h4 className="font-bold text-sm">Evento #{idx + 1}</h4>
                    <Badge variant="outline">{new Date(entry.created_at).toLocaleString()}</Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Ação</p>
                    <p className={`text-xs font-mono p-2 rounded truncate border ${entry.action !== other.action ? 'border-yellow-500/50 bg-yellow-500/5' : 'bg-muted'}`} title={entry.action}>
                      {entry.action}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Parâmetros (Com Destaque)</p>
                    <div className="bg-black/95 p-3 rounded-md overflow-x-auto font-mono text-[10px] h-[400px]">
                      {Object.keys(entry.params || {}).map(key => {
                        const val = entry.params[key];
                        const otherVal = other.params?.[key];
                        const isDiff = JSON.stringify(val) !== JSON.stringify(otherVal);
                        
                        return (
                          <div key={key} className={`mb-1 ${isDiff ? 'text-yellow-400 font-bold bg-yellow-400/10' : 'text-green-400 opacity-70'}`}>
                            {key}: {JSON.stringify(val, null, 2)}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {entry.params?.error && (
                    <div className="p-2 border border-destructive/30 bg-destructive/5 rounded-md">
                      <p className="text-[10px] font-bold text-destructive uppercase">Erro Detectado</p>
                      <p className="text-xs text-destructive">{entry.params.error.message}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
