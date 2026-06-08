import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  AlertTriangle, Save, History, ChevronRight, Info, AlertCircle 
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
  const { user } = useAuth();
  
  const [search, setSearch] = useState("");
  const [step, setStep] = useState("all");
  const [status, setStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditTrail | null>(null);
  const [savedFilters, setSavedFilters] = useState<any[]>(() => {
    const saved = localStorage.getItem("creative_audit_filters");
    return saved ? JSON.parse(saved) : [];
  });

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
    const failures: Record<string, { count: number; lastTrace: string; lastCorrelation: string }> = {};
    entries.forEach(entry => {
      const isError = entry.action.toLowerCase().includes("failed") || entry.action.toLowerCase().includes("error") || entry.params?.error;
      if (isError) {
        const key = entry.params?.error?.message || entry.action;
        if (!failures[key]) failures[key] = { count: 0, lastTrace: "", lastCorrelation: "" };
        failures[key].count++;
        failures[key].lastTrace = entry.trace_id || "";
        failures[key].lastCorrelation = entry.correlation_id || "";
      }
    });
    return Object.entries(failures)
      .filter(([_, v]) => v.count > 1)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);
  }, [entries]);

  // Multiple attempts detection
  const multipleAttempts = useMemo(() => {
    const correlations: Record<string, number> = {};
    entries.forEach(entry => {
      if (entry.correlation_id) {
        correlations[entry.correlation_id] = (correlations[entry.correlation_id] || 0) + 1;
      }
    });
    return Object.entries(correlations).filter(([_, v]) => v > 1).length;
  }, [entries]);

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
            <FileDown className="h-4 w-4 mr-2" /> JSON
          </Button>
          <Button variant="outline" onClick={() => exportData("csv")}>
            <FileDown className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ID, Correlation, Trace ou Ação..."
                className="pl-9"
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
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              placeholder="Início"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              placeholder="Fim"
            />
          </div>
          {(debouncedSearch || step !== "all" || status !== "all" || startDate || endDate) && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch(""); setStep("all"); setStatus("all"); setStartDate(""); setEndDate(""); setPage(1);
              }}>
                <X className="h-4 w-4 mr-2" /> Limpar Filtros
              </Button>
            </div>
          )}
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
                  <TableHead className="text-right">Detalhes</TableHead>
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
                  entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs font-medium">
                        {new Date(entry.created_at).toLocaleString()}
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
                          {entry.correlation_id && (
                            <span className="text-[10px] text-muted-foreground">C: {entry.correlation_id}</span>
                          )}
                          {entry.trace_id && (
                            <span className="text-[10px] text-muted-foreground">T: {entry.trace_id}</span>
                          )}
                          {!entry.correlation_id && !entry.trace_id && (
                            <span className="text-[10px] text-muted-foreground italic">N/A</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            console.log("Audit Params:", entry.params);
                            toast.info("Parâmetros registrados", {
                              description: JSON.stringify(entry.params).slice(0, 100) + "..."
                            });
                          }}
                        >
                          Ver Params
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {entries.length} de {count} registros
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm font-medium">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
