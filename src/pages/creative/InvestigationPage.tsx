import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RotateCw, Ban, FileDown, Search, ExternalLink, AlertTriangle, ArrowUpDown, Loader2, X, Info, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);



type Asset = {
  id: string;
  tool: string;
  status: string;
  prompt: string | null;
  output_url: string | null;
  metadata: any;
  credits_spent: number;
  created_at: string;
  updated_at: string;
};

type AuditEntry = {
  id: string;
  asset_id?: string;
  export_id?: string;
  action?: string;
  event_type?: string;
  user_id: string | null;
  details?: any;
  metadata?: any;
  created_at: string;
};

const PAGE_SIZE = 20;

export default function InvestigationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Filters from URL/State
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<string>(params.get("status") ?? "failed");
  const [tool, setTool] = useState<string>(params.get("tool") ?? "all");
  const [startDate, setStartDate] = useState<string>(params.get("from") ?? "");
  const [endDate, setEndDate] = useState<string>(params.get("to") ?? "");
  const [sortField, setSortField] = useState<"created_at" | "updated_at" | "tool" | "status">((params.get("sort") as any) ?? "created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((params.get("dir") as any) ?? "desc");
  const [page, setPage] = useState(Number(params.get("page") ?? "1"));

  const debouncedSearch = useDebounce(search, 500);
  const debouncedStatus = useDebounce(status, 300);
  const debouncedTool = useDebounce(tool, 300);
  const debouncedStartDate = useDebounce(startDate, 300);
  const debouncedEndDate = useDebounce(endDate, 300);

  // Sync state to URL - only when debounced values change
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debouncedSearch) next.set("q", debouncedSearch); else next.delete("q");
    if (debouncedStatus !== "all") next.set("status", debouncedStatus); else next.delete("status");
    if (debouncedTool !== "all") next.set("tool", debouncedTool); else next.delete("tool");
    if (debouncedStartDate) next.set("from", debouncedStartDate); else next.delete("from");
    if (debouncedEndDate) next.set("to", debouncedEndDate); else next.delete("to");
    if (page > 1) next.set("page", String(page)); else next.delete("page");
    if (sortField !== "created_at") next.set("sort", sortField); else next.delete("sort");
    if (sortDir !== "desc") next.set("dir", sortDir); else next.delete("dir");
    
    // Check if anything actually changed before updating to avoid loops
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
  }, [debouncedSearch, debouncedStatus, debouncedTool, debouncedStartDate, debouncedEndDate, page, sortField, sortDir]);

  // Main Assets Query
  const { data: assetsData, isLoading: loading, error: queryError, refetch: fetchAssets } = useQuery({
    queryKey: ["creative-assets", user?.id, debouncedStatus, debouncedTool, debouncedSearch, debouncedStartDate, debouncedEndDate, sortField, sortDir, page],
    queryFn: async () => {
      if (!user) throw new Error("Não autenticado");
      
      let q = supabase
        .from("creative_assets")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (debouncedStatus !== "all") q = q.eq("status", debouncedStatus);
      if (debouncedTool !== "all") q = q.eq("tool", debouncedTool);
      if (debouncedSearch) q = q.or(`prompt.ilike.%${debouncedSearch}%,id.eq.${isUUID(debouncedSearch) ? debouncedSearch : "00000000-0000-0000-0000-000000000000"}`);
      if (debouncedStartDate) q = q.gte("created_at", debouncedStartDate);
      if (debouncedEndDate) q = q.lte("created_at", debouncedEndDate + "T23:59:59");

      q = q.order(sortField, { ascending: sortDir === "asc" });
      q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) throw error;
      return { assets: (data as Asset[]) || [], count: count ?? 0 };
    },
    enabled: !!user,
    staleTime: 30000,
    retry: 2,
  });

  const assets = assetsData?.assets || [];
  const count = assetsData?.count || 0;
  const error = queryError ? (queryError as Error).message : null;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));



  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("creative-investigation")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creative_assets", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["creative-assets"] });
          // Also refresh detail if currently open
          const investigateId = params.get("investigate");
          if (investigateId) queryClient.invalidateQueries({ queryKey: ["asset-detail", investigateId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient, params]);

  const investigateId = params.get("investigate");

  // Asset Details Query
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["asset-detail", investigateId],
    queryFn: async () => {
      if (!investigateId) return null;
      
      const { data: a, error: aErr } = await supabase.from("creative_assets").select("*").eq("id", investigateId).maybeSingle();
      if (aErr) throw aErr;
      if (!a) throw new Error("Execução não encontrada");

      const { data: logs, error: lErr } = await supabase
        .from("creative_audit_logs")
        .select("*")
        .eq("asset_id", investigateId)
        .order("created_at", { ascending: false });
      if (lErr) throw lErr;
      
      return { selected: a as Asset, audit: (logs as AuditEntry[]) || [] };
    },
    enabled: !!investigateId,
    retry: 2,
  });

  const selected = detailData?.selected || null;
  const audit = detailData?.audit || [];

  const loadDetail = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("investigate", id);
    setParams(next, { replace: true });
  };


  async function recordAudit(assetId: string, action: string, details: any = {}) {
    if (!user) return;
    await supabase.from("creative_audit_logs").insert({
      asset_id: assetId,
      user_id: user.id,
      event_type: action,
      metadata: { ...details, actor_email: user.email, at: new Date().toISOString() },
    } as any);
  }

  async function cancelAsset(a: Asset) {
    if (!confirm(`Cancelar execução ${a.id.slice(0, 8)}?`)) return;
    const { error } = await supabase
      .from("creative_assets")
      .update({ status: "cancelled", metadata: { ...(a.metadata || {}), cancelled_at: new Date().toISOString() } })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    await recordAudit(a.id, "cancel", { reason: "user_request" });
    toast.success("Execução cancelada");
    if (selected?.id === a.id) queryClient.invalidateQueries({ queryKey: ["asset-detail", a.id] });
  }

  async function requeueAsset(a: Asset) {
    const { error } = await supabase
      .from("creative_assets")
      .update({ status: "processing", metadata: { ...(a.metadata || {}), requeued_at: new Date().toISOString() } })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    await recordAudit(a.id, "retry", { previous_status: a.status });
    toast.success("Reenfileirado para nova tentativa");
    if (selected?.id === a.id) queryClient.invalidateQueries({ queryKey: ["asset-detail", a.id] });
  }

  function exportAudit(format: "json" | "csv") {
    if (!selected) return;
    const filtered = audit.filter((e) => {
      if (startDate && new Date(e.created_at) < new Date(startDate)) return false;
      if (endDate && new Date(e.created_at) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
    const filename = `audit-${selected.id.slice(0, 8)}-${Date.now()}.${format}`;
    let content: string;
    let mime: string;
    if (format === "json") {
      content = JSON.stringify(filtered, null, 2);
      mime = "application/json";
    } else {
      const cols = ["id", "asset_id", "event_type", "user_id", "created_at", "metadata"];
      const rows = filtered.map((e) =>
        cols.map((c) => JSON.stringify((e as any)[c] ?? "")).join(",")
      );
      content = [cols.join(","), ...rows].join("\n");
      mime = "text/csv";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Trilha exportada (${filtered.length} itens)`);
  }

  const distinctTools = useMemo(() => Array.from(new Set(assets.map((a) => a.tool))), [assets]);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/creative")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Investigação de Falhas
          </h1>
          <p className="text-xs text-muted-foreground">Atualização em tempo real • {count} resultados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/creative/notifications")}>
          Preferências de e-mail
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/creative/presets")}>
          Presets
        </Button>
      </header>

      <div className="p-4 grid lg:grid-cols-[1fr_400px] gap-4">
        <div className="space-y-3">
          <Card className="p-3">
            <div className="grid md:grid-cols-5 gap-2">
              <div className="relative md:col-span-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="filter-search"
                  className="pl-8"
                  placeholder="Buscar por prompt, ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger data-testid="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
              <Input
                data-testid="filter-start-date"
                type="date" value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              />
              <Input
                data-testid="filter-end-date"
                type="date" value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="mt-2 flex gap-2 flex-wrap items-center">
              <Select value={tool} onValueChange={(v) => { setTool(v); setPage(1); }}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Ferramenta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ferramentas</SelectItem>
                  {["chat","nano_banana","downloader","clips","avatar","shorts","music","ebook","emo", ...distinctTools]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                data-testid="btn-clear-filters"
                onClick={() => {
                  setSearch(""); setStatus("all"); setTool("all"); setStartDate(""); setEndDate(""); setPage(1);
                  toast.info("Filtros limpos");
                }}
              >
                <X className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            </div>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><button onClick={() => toggleSort("tool")} className="flex items-center gap-1">Ferramenta <ArrowUpDown className="h-3 w-3"/></button></TableHead>
                  <TableHead>Execução</TableHead>
                  <TableHead><button onClick={() => toggleSort("status")} className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3"/></button></TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead><button onClick={() => toggleSort("created_at")} className="flex items-center gap-1">Quando <ArrowUpDown className="h-3 w-3"/></button></TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!loading && error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-destructive">
                        <AlertTriangle className="h-8 w-8" />
                        <p>{error}</p>
                        <Button variant="outline" size="sm" onClick={() => fetchAssets()}>Tentar novamente</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && assets.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma execução com os filtros atuais</TableCell></TableRow>
                )}
                {!loading && !error && assets.map((a) => (
                  <TableRow key={a.id} data-testid="investigation-row" className={`cursor-pointer transition-colors ${selected?.id === a.id ? 'bg-muted/50' : 'hover:bg-muted/30'}`} onClick={() => loadDetail(a.id)}>
                    <TableCell><Badge variant="outline">{a.tool}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{a.id.slice(0, 8)}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{a.metadata?.error ?? a.metadata?.reason ?? "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {(a.status === "processing" || a.status === "queued") && (
                        <Button data-testid="btn-cancel" variant="ghost" size="sm" onClick={() => cancelAsset(a)} title="Cancelar"><Ban className="h-4 w-4" /></Button>
                      )}
                      {(a.status === "failed" || a.status === "error" || a.status === "cancelled") && (
                        <Button data-testid="btn-requeue" variant="ghost" size="sm" onClick={() => requeueAsset(a)} title="Reenfileirar"><RotateCw className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between p-3 border-t border-border">
              <div className="text-xs text-muted-foreground">Página {page} de {totalPages}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4 h-fit sticky top-4">
          {detailLoading ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
              <div className="space-y-2 pt-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ) : !selected ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-center p-6 space-y-4 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <div className="bg-muted p-3 rounded-full">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Nenhuma execução selecionada</p>
                <p className="text-sm">Selecione uma linha na tabela para ver os detalhes completos e trilha de auditoria.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300" data-testid="investigation-detail">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    Detalhes: {selected.id.slice(0, 8)}
                    <Badge variant="secondary" className="font-mono text-[10px]">{selected.tool}</Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setParams((p) => { p.delete("investigate"); return p; }); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Prompt / Entrada</Label>
                <p className="text-sm bg-muted/30 p-2 rounded border border-border/50 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {selected.prompt || "Nenhum prompt disponível"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded border border-border bg-muted/10">
                  <Label className="text-[10px] uppercase text-muted-foreground block">Créditos</Label>
                  <span className="text-sm font-semibold">{selected.credits_spent}</span>
                </div>
                <div className="p-2 rounded border border-border bg-muted/10">
                  <Label className="text-[10px] uppercase text-muted-foreground block">Status</Label>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              <div className="flex gap-2">
                {(selected.status === "failed" || selected.status === "error" || selected.status === "cancelled") && (
                  <Button data-testid="detail-requeue" size="sm" className="flex-1" onClick={() => requeueAsset(selected)}><RotateCw className="h-3 w-3 mr-1" /> Reenfileirar</Button>
                )}
                {(selected.status === "processing" || selected.status === "queued") && (
                  <Button data-testid="detail-cancel" size="sm" variant="destructive" className="flex-1" onClick={() => cancelAsset(selected)}><Ban className="h-3 w-3 mr-1" /> Cancelar</Button>
                )}
                {selected.output_url && (
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <a href={selected.output_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Ver Output</a>
                  </Button>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-1">
                    Trilha de Auditoria
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Histórico completo de eventos e ações para esta execução.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                  <div className="flex gap-1">
                    <Button data-testid="export-audit-json" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportAudit("json")} title="Exportar JSON"><FileDown className="h-3.5 w-3.5" /></Button>
                    <Button data-testid="export-audit-csv" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportAudit("csv")} title="Exportar CSV"><Package className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {audit.length === 0 ? (
                    <p className="text-xs text-center py-4 text-muted-foreground italic">Nenhum log registrado</p>
                  ) : (
                    audit.map((e) => (
                      <div key={e.id} className="text-xs border-l-2 border-primary/30 pl-3 py-1 hover:border-primary transition-colors">
                        <div className="flex justify-between font-medium">
                          <span className="capitalize">{e.event_type?.replace(/_/g, " ") || "Evento"}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                        </div>
                        {e.metadata?.error && <p className="text-destructive font-mono mt-1 break-all">{e.metadata.error}</p>}
                        {e.metadata?.actor_email && <p className="text-[10px] text-muted-foreground mt-1">Por: {e.metadata.actor_email}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: any = {
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    processing: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    queued: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  };
  return <Badge variant="outline" className={`capitalize ${variants[status] || ""}`}>{status}</Badge>;
}

function Label({ children, className, ...props }: any) {
  return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>{children}</label>;
}


