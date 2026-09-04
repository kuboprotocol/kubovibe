import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Coins,
  Cpu,
  Loader2,
  MonitorSmartphone,
  Plug,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Actions billed by the Windows daemon and the VS Code / Cursor extension. */
const AGENT_ACTIONS: Record<string, { label: string; cost: number }> = {
  local_agent_chat: { label: "Chat message", cost: 1 },
  local_agent_edit: { label: "Code edit", cost: 2 },
  local_agent_run: { label: "Agent run", cost: 4 },
  local_agent_terminal: { label: "Terminal command", cost: 0 },
  local_agent_git: { label: "Git operation", cost: 0 },
};

const DEFAULT_DAEMON_PORT = 43117;

interface LedgerRow {
  id: string;
  user_id: string;
  delta: number;
  balance_after: number | null;
  reason: string | null;
  category: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface DaemonHealth {
  reachable: boolean;
  version?: string;
  checkedAt: string;
  error?: string;
}

const formatTime = (iso: string) => new Date(iso).toLocaleString();

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Observability for the KUBO Local Agent (Windows daemon + VS Code/Cursor extension):
 * live daemon health plus the real credit ledger entries it produces. */
export default function AdminAgentPage() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [port, setPort] = useState(String(DEFAULT_DAEMON_PORT));
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [pinging, setPinging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("category", "local_agent")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as unknown as LedgerRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin-local-agent")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "credit_transactions", filter: "category=eq.local_agent" },
        (payload) => setRows((prev) => [payload.new as LedgerRow, ...prev].slice(0, 500)),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  /** The daemon listens on loopback only, so this check runs from the operator's own machine. */
  const ping = useCallback(async () => {
    setPinging(true);
    const checkedAt = new Date().toISOString();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
      clearTimeout(timer);
      const payload = await res.json().catch(() => ({}));
      setHealth({
        reachable: res.ok,
        version: typeof payload?.version === "string" ? payload.version : undefined,
        checkedAt,
      });
    } catch (err) {
      setHealth({
        reachable: false,
        checkedAt,
        error: err instanceof Error ? err.message : "unreachable",
      });
    } finally {
      setPinging(false);
    }
  }, [port]);

  useEffect(() => {
    void ping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.reason, r.user_id, JSON.stringify(r.metadata ?? {})]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const byAction = useMemo(() => {
    const map = new Map<string, { action: string; runs: number; credits: number; last: string }>();
    for (const row of rows) {
      const action = row.reason ?? "unknown";
      const entry = map.get(action) ?? { action, runs: 0, credits: 0, last: row.created_at };
      entry.runs += 1;
      entry.credits += Math.abs(Number(row.delta ?? 0));
      if (row.created_at > entry.last) entry.last = row.created_at;
      map.set(action, entry);
    }
    return [...map.values()].sort((a, b) => b.credits - a.credits);
  }, [rows]);

  const totals = useMemo(() => {
    const credits = rows.reduce((acc, r) => acc + Math.abs(Number(r.delta ?? 0)), 0);
    const users = new Set(rows.map((r) => r.user_id)).size;
    const last24 = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 86_400_000).length;
    return { credits, users, last24, events: rows.length };
  }, [rows]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-6xl space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/admin" aria-label="Back to admin">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-orbitron text-2xl font-bold">Local Agent</h1>
              <p className="text-sm text-muted-foreground">
                Windows daemon and VS Code / Cursor extension — live status and real credit usage.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Coins} label="Credits billed" value={totals.credits.toFixed(2)} hint="local_agent category" />
          <StatCard icon={Activity} label="Events" value={String(totals.events)} hint={`${totals.last24} in last 24h`} />
          <StatCard icon={MonitorSmartphone} label="Machines / users" value={String(totals.users)} />
          <StatCard
            icon={Plug}
            label="Daemon"
            value={health?.reachable ? "online" : "offline"}
            hint={health ? `checked ${new Date(health.checkedAt).toLocaleTimeString()}` : "checking…"}
          />
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4 text-primary" /> Daemon health
            </CardTitle>
            <CardDescription>
              The daemon binds to 127.0.0.1 only — this check runs from the machine you have open right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="w-32"
                aria-label="Daemon port"
              />
              <Button onClick={() => void ping()} disabled={pinging}>
                {pinging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                Ping daemon
              </Button>
              <Badge
                variant="outline"
                className={cn(
                  health?.reachable ? "border-emerald-500/30 text-emerald-400" : "border-destructive/40 text-destructive",
                )}
              >
                http://127.0.0.1:{port}/health
              </Badge>
            </div>
            {health && !health.reachable ? (
              <p className="text-xs text-muted-foreground">
                Not reachable ({health.error ?? "no response"}). Start it with{" "}
                <code className="rounded bg-muted px-1">kubo-agent.exe</code> or check the port in the extension
                setting <code className="rounded bg-muted px-1">kubo.agentPort</code>.
              </p>
            ) : null}
            {health?.version ? <p className="text-xs text-muted-foreground">Version {health.version}</p> : null}
          </CardContent>
        </Card>

        <Tabs defaultValue="actions">
          <TabsList>
            <TabsTrigger value="actions">By action</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="mt-4">
            <Card className="glass-card">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3">Action</th>
                      <th className="p-3">Unit cost</th>
                      <th className="p-3">Runs</th>
                      <th className="p-3">Credits</th>
                      <th className="p-3">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAction.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          No local agent usage yet.
                        </td>
                      </tr>
                    ) : (
                      byAction.map((row) => (
                        <tr key={row.action} className="border-b border-border/30">
                          <td className="p-3 font-medium">{AGENT_ACTIONS[row.action]?.label ?? row.action}</td>
                          <td className="p-3 text-muted-foreground">
                            {AGENT_ACTIONS[row.action]?.cost ?? "—"}
                          </td>
                          <td className="p-3">{row.runs}</td>
                          <td className="p-3 text-primary">{row.credits.toFixed(2)}</td>
                          <td className="p-3 text-xs text-muted-foreground">{formatTime(row.last)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4 space-y-3">
            <Input
              placeholder="Filter by action, user or project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Card className="glass-card">
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b border-border/60 bg-card text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3">When</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Credits</th>
                        <th className="p-3">Balance</th>
                        <th className="p-3">Project</th>
                        <th className="p-3">User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            <Terminal className="mx-auto mb-2 h-5 w-5" />
                            Nothing logged yet — run a command from the daemon or the extension.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((row) => (
                          <tr key={row.id} className="border-b border-border/30">
                            <td className="p-3 text-xs text-muted-foreground">{formatTime(row.created_at)}</td>
                            <td className="p-3">{AGENT_ACTIONS[row.reason ?? ""]?.label ?? row.reason ?? "—"}</td>
                            <td className="p-3 text-primary">{Math.abs(Number(row.delta ?? 0)).toFixed(2)}</td>
                            <td className="p-3 text-muted-foreground">
                              {row.balance_after === null ? "—" : Number(row.balance_after).toFixed(2)}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {String((row.metadata as { project_id?: string } | null)?.project_id ?? "—").slice(0, 8)}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">{row.user_id.slice(0, 8)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
