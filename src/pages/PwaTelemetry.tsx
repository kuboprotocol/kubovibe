import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCsrfToken } from "@/utils/pwaTelemetry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Trash2, Image as ImageIcon, FileCode, Type, Search, ChevronLeft, ChevronRight,
  LayoutGrid, List, X, AlertTriangle, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type RemoteEvent = {
  id: string;
  user_id: string | null;
  session_id: string;
  canvas_id: string | null;
  type: string;
  url: string;
  created_at: string;
};
type SessionAgg = { session_id: string; count: number; first: string; last: string; types: Record<string, number> };

const PAGE_SIZE = 25;
const READER_ROLES = ["admin", "analyst", "viewer"];
const ADMIN_ROLES = ["admin", "analyst"];
const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co`;

const typeBadge = (t: string) => {
  switch (t) {
    case "image": return <Badge variant="secondary" className="gap-1"><ImageIcon className="w-3 h-3" /> PNG</Badge>;
    case "svg":   return <Badge variant="outline"  className="gap-1"><FileCode  className="w-3 h-3" /> SVG</Badge>;
    case "font":  return <Badge variant="default"  className="gap-1"><Type      className="w-3 h-3" /> WOFF2</Badge>;
    default:      return <Badge variant="outline">{t}</Badge>;
  }
};

const PwaTelemetry = () => {
  const { hasAnyRole, roles, loading: authLoading } = useAuth();
  const canRead = hasAnyRole(READER_ROLES);
  const canManage = hasAnyRole(ADMIN_ROLES);

  const [params, setParams] = useSearchParams();
  const filters = {
    type:      params.get("type")      ?? "all",
    q:         params.get("q")         ?? "",
    canvasId:  params.get("canvasId")  ?? "",
    userId:    params.get("userId")    ?? "",
    sessionId: params.get("sessionId") ?? "",
    sort:      (params.get("sort") as "asc" | "desc") ?? "desc",
    page:      parseInt(params.get("page") ?? "1"),
    sigma:     parseFloat(params.get("sigma") ?? "2"),
  };

  const updateParam = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === "" || (k === "type" && v === "all")) next.delete(k);
      else next.set(k, String(v));
    });
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  const [events, setEvents] = useState<RemoteEvent[]>([]);
  const [summary, setSummary] = useState<SessionAgg[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isCapped, setIsCapped] = useState(false);

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const qs = new URLSearchParams();
      qs.set("page", String(filters.page));
      qs.set("pageSize", String(PAGE_SIZE));
      qs.set("sort", filters.sort);
      qs.set("sigma", String(filters.sigma));
      if (filters.type !== "all") qs.set("type", filters.type);
      if (filters.q) qs.set("q", filters.q);
      if (filters.canvasId) qs.set("canvasId", filters.canvasId);
      if (filters.userId) qs.set("userId", filters.userId);
      if (filters.sessionId) qs.set("sessionId", filters.sessionId);

      const res = await fetch(`${FUNCTIONS_URL}/pwa-telemetry?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const json = await res.json();
      setEvents(json.events ?? []);
      setSummary(json.summary ?? []);
      setTotal(json.total ?? 0);
      setIsCapped(json.isCapped ?? false);
      
      // If server returned a different sigma (e.g. non-admin tried to set one), sync it back
      if (json.appliedSigma !== undefined && json.appliedSigma !== filters.sigma) {
        updateParam({ sigma: json.appliedSigma });
      }
    } catch (e: any) {
      toast.error(`Falha ao carregar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [canRead, filters.page, filters.sort, filters.type, filters.q, filters.canvasId, filters.userId, filters.sessionId, filters.sigma]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Anomaly: fallback rate > mean + Nσ across sessions with >= 5 events
  const anomaly = useMemo(() => {
    const eligible = summary.filter((s) => s.count >= 5);
    if (eligible.length < 3) return null;
    const counts = eligible.map((s) => s.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const sd = Math.sqrt(variance);
    const threshold = mean + filters.sigma * sd;
    const anomalous = eligible.filter((s) => s.count > threshold);
    return anomalous.length ? { anomalous, threshold: Math.round(threshold), mean: Math.round(mean) } : null;
  }, [summary, filters.sigma]);

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportFmt, setExportFmt] = useState<"csv" | "json">("csv");
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    if (!canRead) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const qs = new URLSearchParams();
      qs.set("export", exportFmt);
      if (exportStart) qs.set("start", new Date(exportStart).toISOString());
      if (exportEnd) qs.set("end", new Date(exportEnd).toISOString());
      if (filters.type !== "all") qs.set("type", filters.type);
      if (filters.canvasId) qs.set("canvasId", filters.canvasId);
      if (filters.userId) qs.set("userId", filters.userId);
      if (filters.sessionId) qs.set("sessionId", filters.sessionId);
      
      const res = await fetch(`${FUNCTIONS_URL}/pwa-telemetry?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export falhou" }));
        throw new Error(err.message || err.error || "Export falhou");
      }
      
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pwa-telemetry-${Date.now()}.${exportFmt}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setExportOpen(false);
      toast.success("Exportação concluída com sucesso.");
    } catch (e: any) {
      console.error("Export error:", e);
      // We keep the dialog open if there's an error so they can retry
      toast.error(`Erro ao exportar: ${e.message}. Tente reduzir o período ou verificar os filtros.`);
    } finally {
      setExporting(false);
    }
  };

  const [clearOpen, setClearOpen] = useState(false);
  const [clearScope, setClearScope] = useState<"filtered" | "all">("filtered");
  const [clearing, setClearing] = useState(false);

  const doClear = async () => {
    if (!canManage) return;
    setClearing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const csrf = getCsrfToken();
      const body: any = { csrfToken: csrf };
      if (clearScope === "all") body.all = true;
      else {
        body.scope = {};
        if (filters.type !== "all") body.scope.type = filters.type;
        if (filters.sessionId) body.scope.sessionId = filters.sessionId;
        if (Object.keys(body.scope).length === 0) body.all = true;
      }
      const res = await fetch(`${FUNCTIONS_URL}/pwa-telemetry-clear`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Falha ao limpar");
      toast.success(`Removidos ${j.deleted} eventos`);
      setClearOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClearing(false);
    }
  };

  if (authLoading) return <div className="container py-10">Carregando…</div>;

  if (!canRead) {
    return (
      <div className="container max-w-2xl py-10">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Você precisa do papel <strong>admin</strong>, <strong>analyst</strong> ou <strong>viewer</strong> para
            acessar a telemetria do PWA. Papéis atuais: {roles.join(", ") || "nenhum"}.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeChips: Array<{ key: string; label: string }> = [];
  if (filters.type !== "all") activeChips.push({ key: "type", label: `Tipo: ${filters.type}` });
  if (filters.canvasId)       activeChips.push({ key: "canvasId", label: `Canvas: ${filters.canvasId}` });
  if (filters.userId)         activeChips.push({ key: "userId", label: `User: ${filters.userId.slice(0, 8)}…` });
  if (filters.sessionId)      activeChips.push({ key: "sessionId", label: `Sessão: ${filters.sessionId.slice(0, 8)}…` });
  if (filters.q)              activeChips.push({ key: "q", label: `Busca: ${filters.q}` });

  return (
    <div className="container mx-auto py-10 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PWA Audit & Telemetry</h1>
          <p className="text-muted-foreground">
            Eventos de fallback offline com controle de acesso por papel. Papéis:{" "}
            <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3" /> {roles.join(", ") || "—"}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={exportOpen} onOpenChange={setExportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exportar telemetria</DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>Defina um período para exportar (limite de 10.000 eventos por requisição). Os filtros ativos serão aplicados.</p>
                  <div className="text-xs bg-muted p-2 rounded border space-y-1">
                    <p className="font-semibold">Filtros Ativos:</p>
                    <ul className="list-disc list-inside">
                      {activeChips.length > 0 ? activeChips.map(c => <li key={c.key}>{c.label}</li>) : <li>Nenhum filtro aplicado</li>}
                      {exportStart && <li>Início: {new Date(exportStart).toLocaleString()}</li>}
                      {exportEnd && <li>Fim: {new Date(exportEnd).toLocaleString()}</li>}
                    </ul>
                    {total > 10000 && (
                      <p className="text-destructive font-medium">
                        ⚠️ Atenção: O total de eventos ({total.toLocaleString()}) excede o limite de 10k. 
                        Apenas os 10.000 eventos mais recentes no período selecionado serão exportados.
                      </p>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start">Início</Label>
                  <Input id="start" type="datetime-local" value={exportStart} onChange={(e) => setExportStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end">Fim</Label>
                  <Input id="end" type="datetime-local" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Formato</Label>
                  <Select value={exportFmt} onValueChange={(v: any) => setExportFmt(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={doExport} disabled={exporting}>
                  {exporting ? "Exportando..." : "Baixar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {canManage && (
            <Dialog open={clearOpen} onOpenChange={setClearOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" />Limpar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Limpar telemetria</DialogTitle>
                  <DialogDescription>Esta ação é irreversível. Escolha o escopo.</DialogDescription>
                </DialogHeader>
                <Select value={clearScope} onValueChange={(v: any) => setClearScope(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filtered">Apenas filtros ativos (tipo/sessão)</SelectItem>
                    <SelectItem value="all">Tudo</SelectItem>
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>Cancelar</Button>
                  <Button variant="destructive" onClick={doClear} disabled={clearing}>
                    {clearing ? "Limpando..." : "Confirmar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {anomaly && (
        <Alert role="alert" aria-live="polite">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Anomalia detectada na taxa de fallback</AlertTitle>
          <AlertDescription>
            {anomaly.anomalous.length} sessão(ões) acima do limite estatístico ({anomaly.threshold}, média {anomaly.mean}).{" "}
            {anomaly.anomalous.slice(0, 5).map((s) => (
              <Link
                key={s.session_id}
                to={`?sessionId=${s.session_id}`}
                className="underline mr-2"
                aria-label={`Ver sessão ${s.session_id} com ${s.count} eventos a partir de ${new Date(s.first).toLocaleString()}`}
              >
                {s.session_id.slice(0, 8)}… ({s.count})
              </Link>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Filtros e Controles</CardTitle>
            {hasAnyRole(["admin"]) && (
              <div className="flex items-center gap-2 text-sm border rounded-md p-1 bg-muted/50">
                <ShieldCheck className="w-3 h-3 text-primary" />
                <Label htmlFor="sigma" className="text-xs font-medium">Anomaly Threshold (Nσ):</Label>
                <Input
                  id="sigma"
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="h-7 w-16 text-xs"
                  defaultValue={filters.sigma}
                  onBlur={(e) => updateParam({ sigma: parseFloat(e.target.value) || 2 })}
                  onKeyDown={(e) => { if (e.key === "Enter") updateParam({ sigma: parseFloat((e.target as HTMLInputElement).value) || 2 }); }}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Busca livre (URL / sessão / canvas)…"
                className="pl-9"
                defaultValue={filters.q}
                onKeyDown={(e) => { if (e.key === "Enter") updateParam({ q: (e.target as HTMLInputElement).value }); }}
              />
            </div>
            <Input
              placeholder="canvasId"
              defaultValue={filters.canvasId}
              onKeyDown={(e) => { if (e.key === "Enter") updateParam({ canvasId: (e.target as HTMLInputElement).value }); }}
            />
            <Input
              placeholder="userId (uuid)"
              defaultValue={filters.userId}
              onKeyDown={(e) => { if (e.key === "Enter") updateParam({ userId: (e.target as HTMLInputElement).value }); }}
            />
            <div className="flex gap-2">
              <Select value={filters.type} onValueChange={(v) => updateParam({ type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="image">PNG</SelectItem>
                  <SelectItem value="svg">SVG</SelectItem>
                  <SelectItem value="font">WOFF2</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.sort} onValueChange={(v) => updateParam({ sort: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">↓ Recentes</SelectItem>
                  <SelectItem value="asc">↑ Antigos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeChips.map((c) => (
                <Badge key={c.key} variant="secondary" className="gap-1">
                  {c.label}
                  <button
                    aria-label={`Remover filtro ${c.key}`}
                    onClick={() => updateParam({ [c.key]: null })}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Limpar filtros
              </Button>
            </div>
          )}
        </CardHeader>
      </Card>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="gap-2"><List className="w-4 h-4" /> Eventos ({total})</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2"><LayoutGrid className="w-4 h-4" /> Sessões ({summary.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Sessão</TableHead>
                      <TableHead>Canvas</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Arquivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Carregando…</TableCell></TableRow>
                    ) : events.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum evento.</TableCell></TableRow>
                    ) : events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs font-mono">{new Date(e.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-mono">
                          <button className="underline" onClick={() => updateParam({ sessionId: e.session_id })}>
                            {e.session_id.slice(0, 8)}…
                          </button>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {e.canvas_id ? (
                            <button className="underline" onClick={() => updateParam({ canvasId: e.canvas_id! })}>
                              {e.canvas_id.slice(0, 10)}
                            </button>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{typeBadge(e.type)}</TableCell>
                        <TableCell className="font-medium truncate max-w-[300px]" title={e.url}>
                          {e.url.split("/").pop()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end gap-2 py-4">
                <Button variant="outline" size="sm" disabled={filters.page <= 1}
                  onClick={() => updateParam({ page: String(filters.page - 1) })}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm">Página {filters.page} de {totalPages}</div>
                <Button variant="outline" size="sm" disabled={filters.page >= totalPages}
                  onClick={() => updateParam({ page: String(filters.page + 1) })}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.map((s) => {
              const totalCount = s.count;
              const fallbackRate = (s.types.image ?? 0) + (s.types.svg ?? 0) + (s.types.font ?? 0);
              const rate = totalCount > 0 ? Math.round((fallbackRate / totalCount) * 100) : 0;
              const isAnom = anomaly?.anomalous.some((a) => a.session_id === s.session_id);
              return (
                <Card key={s.session_id} className={isAnom ? "border-destructive" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono truncate flex items-center gap-2">
                      {isAnom && <AlertTriangle className="w-3 h-3 text-destructive" aria-label="Sessão anômala" />}
                      <button className="underline" onClick={() => updateParam({ sessionId: s.session_id })}>
                        {s.session_id}
                      </button>
                    </CardTitle>
                    <CardDescription>
                      {new Date(s.first).toLocaleString()} → {new Date(s.last).toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-2xl font-bold">{s.count}</div>
                        <div className="text-xs text-muted-foreground">Fallbacks ({rate}%)</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(s.types).map(([t, c]) => (
                        <div key={t} className="flex items-center gap-1.5 text-xs bg-secondary px-2 py-1 rounded-md">
                          {typeBadge(t)} <span className="font-bold">{c}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PwaTelemetry;
