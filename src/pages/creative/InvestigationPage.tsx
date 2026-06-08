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
import { ArrowLeft, RotateCw, Ban, FileDown, Search, ExternalLink, AlertTriangle, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

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

  const [assets, setAssets] = useState<Asset[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  // Filters
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<string>(params.get("status") ?? "failed");
  const [tool, setTool] = useState<string>(params.get("tool") ?? "all");
  const [startDate, setStartDate] = useState<string>(params.get("from") ?? "");
  const [endDate, setEndDate] = useState<string>(params.get("to") ?? "");
  const [sortField, setSortField] = useState<"created_at" | "updated_at" | "tool" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(Number(params.get("page") ?? "1"));

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Persist filters to URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status !== "all") next.set("status", status);
    if (tool !== "all") next.set("tool", tool);
    if (startDate) next.set("from", startDate);
    if (endDate) next.set("to", endDate);
    if (page > 1) next.set("page", String(page));
    setParams(next, { replace: true });
  }, [search, status, tool, startDate, endDate, page, setParams]);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("creative_assets")
      .select("*", { count: "exact" })
      .eq("user_id", user.id);

    if (status !== "all") q = q.eq("status", status);
    if (tool !== "all") q = q.eq("tool", tool);
    if (search) q = q.or(`prompt.ilike.%${search}%,id.eq.${isUUID(search) ? search : "00000000-0000-0000-0000-000000000000"}`);
    if (startDate) q = q.gte("created_at", startDate);
    if (endDate) q = q.lte("created_at", endDate + "T23:59:59");

    q = q.order(sortField, { ascending: sortDir === "asc" });
    q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count: c, error } = await q;
    if (error) toast.error("Erro ao carregar: " + error.message);
    else {
      setAssets((data as Asset[]) || []);
      setCount(c ?? 0);
    }
    setLoading(false);
  }, [user, status, tool, search, startDate, endDate, sortField, sortDir, page]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("creative-investigation")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creative_assets", filter: `user_id=eq.${user.id}` },
        () => fetchAssets()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchAssets]);

  // Investigate from query param
  useEffect(() => {
    const investigateId = params.get("investigate");
    if (investigateId && !selected) loadDetail(investigateId);
  }, [params]); // eslint-disable-line

  async function loadDetail(id: string) {
    const { data: a } = await supabase.from("creative_assets").select("*").eq("id", id).maybeSingle();
    if (!a) return;
    setSelected(a as Asset);
    const { data: logs } = await supabase
      .from("creative_audit_logs")
      .select("*")
      .eq("asset_id", id)
      .order("created_at", { ascending: false });
    setAudit((logs as AuditEntry[]) || []);
  }

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
    if (selected?.id === a.id) loadDetail(a.id);
  }

  async function requeueAsset(a: Asset) {
    const { error } = await supabase
      .from("creative_assets")
      .update({ status: "processing", metadata: { ...(a.metadata || {}), requeued_at: new Date().toISOString() } })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    await recordAudit(a.id, "retry", { previous_status: a.status });
    toast.success("Reenfileirado para nova tentativa");
    if (selected?.id === a.id) loadDetail(a.id);
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
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch(""); setStatus("failed"); setTool("all"); setStartDate(""); setEndDate(""); setPage(1);
              }}>Limpar</Button>
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
                {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!loading && assets.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma execução com os filtros atuais</TableCell></TableRow>}
                {assets.map((a) => (
                  <TableRow key={a.id} data-testid="investigation-row" className="cursor-pointer" onClick={() => loadDetail(a.id)}>
                    <TableCell><Badge variant="outline">{a.tool}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{a.id.slice(0, 8)}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{a.metadata?.error ?? a.metadata?.reason ?? "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {(a.status === "processing" || a.status === "queued") && (
                        <Button data-testid="btn-cancel" variant="ghost" size="sm" onClick={() => cancelAsset(a)}><Ban className="h-4 w-4" /></Button>
                      )}
                      {(a.status === "failed" || a.status === "error" || a.status === "cancelled") && (
                        <Button data-testid="btn-requeue" variant="ghost" size="sm" onClick={() => requeueAsset(a)}><RotateCw className="h-4 w-4" /></Button>
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
          {!selected ? (
            <p className="text-sm text-muted-foreground">Selecione uma execução para ver detalhes, logs e trilha de auditoria.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Execução</div>
                  <div className="font-mono text-sm">{selected.id}</div>
                </div>
                <StatusBadge status={selected.status} />
              </div>
              <div className="text-sm">
                <div className="text-xs text-muted-foreground">Prompt</div>
                <div className="line-clamp-3">{selected.prompt || "—"}</div>
              </div>
              {selected.metadata?.error && (
                <div className="text-sm border-l-2 border-destructive pl-2">
                  <div className="text-xs text-muted-foreground">Motivo do erro</div>
                  <div className="text-destructive">{selected.metadata.error}</div>
                </div>
              )}

              <div className="flex gap-2">
                {(selected.status === "failed" || selected.status === "error" || selected.status === "cancelled") && (
                  <Button data-testid="detail-requeue" size="sm" onClick={() => requeueAsset(selected)}><RotateCw className="h-3 w-3 mr-1"/>Reenfileirar</Button>
                )}
                {(selected.status === "processing" || selected.status === "queued") && (
                  <Button data-testid="detail-cancel" size="sm" variant="destructive" onClick={() => cancelAsset(selected)}><Ban className="h-3 w-3 mr-1"/>Cancelar</Button>
                )}
                {selected.output_url && (
                  <a href={selected.output_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1"/>Logs</Button>
                  </a>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Trilha de auditoria ({audit.length})</h3>
                  <div className="flex gap-1">
                    <Button data-testid="export-audit-json" size="sm" variant="outline" onClick={() => exportAudit("json")}><FileDown className="h-3 w-3 mr-1"/>JSON</Button>
                    <Button data-testid="export-audit-csv" size="sm" variant="outline" onClick={() => exportAudit("csv")}><FileDown className="h-3 w-3 mr-1"/>CSV</Button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {audit.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento registrado</p>}
                  {audit.map((e) => (
                    <div key={e.id} className="text-xs border-l-2 border-primary/40 pl-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{e.event_type ?? e.action}</span>
                        <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-muted-foreground">por {e.metadata?.actor_email ?? e.user_id?.slice(0,8) ?? "sistema"}</div>
                      {e.metadata?.reason && <div>Motivo: {e.metadata.reason}</div>}
                    </div>
                  ))}
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
  const map: Record<string, string> = {
    failed: "bg-destructive text-destructive-foreground",
    error: "bg-destructive text-destructive-foreground",
    cancelled: "bg-amber-500 text-white",
    processing: "bg-blue-500 text-white",
    completed: "bg-emerald-500 text-white",
    queued: "bg-muted text-foreground",
  };
  return <Badge className={map[status] ?? ""}>{status}</Badge>;
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
