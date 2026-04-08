import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Mail, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const TIME_RANGES = [
  { label: "Últimas 24h", value: "24h", hours: 24 },
  { label: "Últimos 7 dias", value: "7d", hours: 168 },
  { label: "Últimos 30 dias", value: "30d", hours: 720 },
];

const STATUS_OPTIONS = [
  { label: "Todos", value: "all" },
  { label: "Enviados", value: "sent" },
  { label: "Falhos", value: "dlq" },
  { label: "Suprimidos", value: "suppressed" },
  { label: "Pendentes", value: "pending" },
];

function statusBadge(status: string) {
  switch (status) {
    case "sent":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Enviado</Badge>;
    case "dlq":
    case "failed":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Falho</Badge>;
    case "suppressed":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Suprimido</Badge>;
    case "pending":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Pendente</Badge>;
    case "bounced":
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Bounce</Badge>;
    case "complained":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Reclamação</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export default function EmailDashboardPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const rangeHours = TIME_RANGES.find((t) => t.value === timeRange)?.hours ?? 168;
  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - rangeHours);
    return d.toISOString();
  }, [rangeHours]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["email-dashboard", since],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-dashboard?since=${encodeURIComponent(since)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch email data");
      return res.json() as Promise<{ logs: EmailLog[]; suppressedCount: number }>;
    },
    refetchInterval: 30000,
  });

  const rawLogs = data?.logs ?? [];
  const suppressedCount = data?.suppressedCount ?? 0;

  // Deduplicate: keep latest row per message_id
  const logs = useMemo(() => {
    const map = new Map<string, EmailLog>();
    for (const row of rawLogs) {
      const key = row.message_id ?? row.id;
      if (!map.has(key)) map.set(key, row);
    }
    return Array.from(map.values());
  }, [rawLogs]);

  const templateNames = useMemo(() => {
    const set = new Set(logs.map((l) => l.template_name));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (templateFilter !== "all" && l.template_name !== templateFilter) return false;
      return true;
    });
  }, [logs, statusFilter, templateFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const sent = filtered.filter((l) => l.status === "sent").length;
    const failed = filtered.filter((l) => ["dlq", "failed"].includes(l.status)).length;
    const suppressed = filtered.filter((l) => l.status === "suppressed").length;
    const pending = filtered.filter((l) => l.status === "pending").length;
    return { total, sent, failed, suppressed, pending };
  }, [filtered]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-['Orbitron']">Monitoramento de Emails</h1>
            <p className="text-sm text-muted-foreground">Estatísticas de envio, falhas e supressões</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {TIME_RANGES.map((t) => (
            <Button
              key={t.value}
              variant={timeRange === t.value ? "default" : "outline"}
              size="sm"
              onClick={() => { setTimeRange(t.value); setPage(0); }}
            >
              {t.label}
            </Button>
          ))}
          <Select value={templateFilter} onValueChange={(v) => { setTemplateFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os templates</SelectItem>
              {templateNames.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Mail className="h-3.5 w-3.5" /> Total
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Enviados
              </div>
              <p className="text-2xl font-bold text-emerald-400">{stats.sent}</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
                <XCircle className="h-3.5 w-3.5" /> Falhos
              </div>
              <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-yellow-400 text-xs mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Suprimidos
              </div>
              <p className="text-2xl font-bold text-yellow-400">{stats.suppressed}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-blue-400 text-xs mb-1">
                <Mail className="h-3.5 w-3.5" /> Pendentes
              </div>
              <p className="text-2xl font-bold text-blue-400">{stats.pending}</p>
            </CardContent>
          </Card>
        </div>

        {suppressedCount > 0 && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="py-3 px-4">
              <p className="text-sm text-yellow-400">
                ⚠️ {suppressedCount} endereço{suppressedCount > 1 ? "s" : ""} suprimido{suppressedCount > 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Email log table */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log de Emails ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : paginated.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum email encontrado neste período
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Template</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((log) => (
                        <TableRow key={log.id} className="border-border">
                          <TableCell className="font-mono text-xs">{log.template_name}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{log.recipient_email}</TableCell>
                          <TableCell>{statusBadge(log.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                          </TableCell>
                          <TableCell className="text-xs text-red-400 max-w-[200px] truncate">
                            {log.error_message || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                        Anterior
                      </Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
