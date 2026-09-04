import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Cpu, Hammer, Loader2, RefreshCw, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ARCH_TARGETS, archLabel, archMultiplier } from "@/lib/buildTargets";

interface BuildRow {
  id: string;
  session_id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  arch: string;
  platform: string;
  status: string;
  command: string | null;
  logs: string | null;
  credits_spent: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  running: "border-amber-500/30 text-amber-400",
  queued: "border-muted-foreground/30 text-muted-foreground",
  succeeded: "border-emerald-500/30 text-emerald-400",
  failed: "border-destructive/40 text-destructive",
};

const formatDuration = (ms: number | null) => {
  if (!ms || ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};

/** Native builds observability: logs, compile time and credit cost per target
 * architecture — all read from the same credit ledger used by KUBO Cloud. */
export default function AdminBuildsPage() {
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BuildRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("session_builds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setBuilds((data ?? []) as unknown as BuildRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-native-builds")
      .on("postgres_changes", { event: "*", schema: "public", table: "session_builds" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return builds;
    return builds.filter((b) =>
      [b.arch, b.platform, b.kind, b.status, b.command ?? "", b.id].some((v) => v.toLowerCase().includes(q)),
    );
  }, [builds, search]);

  const byArch = useMemo(() => {
    const map = new Map<string, { arch: string; runs: number; credits: number; ms: number; failures: number }>();
    for (const target of ARCH_TARGETS) {
      map.set(target.id, { arch: target.id, runs: 0, credits: 0, ms: 0, failures: 0 });
    }
    for (const b of filtered) {
      const row = map.get(b.arch) ?? { arch: b.arch, runs: 0, credits: 0, ms: 0, failures: 0 };
      row.runs += 1;
      row.credits += Number(b.credits_spent ?? 0);
      row.ms += Number(b.duration_ms ?? 0);
      if (b.status === "failed") row.failures += 1;
      map.set(b.arch, row);
    }
    return [...map.values()].filter((r) => r.runs > 0).sort((a, b) => b.credits - a.credits);
  }, [filtered]);

  const totals = useMemo(
    () => ({
      runs: filtered.length,
      credits: filtered.reduce((sum, b) => sum + Number(b.credits_spent ?? 0), 0),
      ms: filtered.reduce((sum, b) => sum + Number(b.duration_ms ?? 0), 0),
      failures: filtered.filter((b) => b.status === "failed").length,
    }),
    [filtered],
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/admin" aria-label="Back to admin">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-orbitron text-2xl text-foreground">Native builds</h1>
              <p className="text-sm text-muted-foreground">Logs, compile time and credit cost per architecture.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard icon={Hammer} label="Builds" value={String(totals.runs)} />
          <StatCard icon={Coins} label="Credits spent" value={totals.credits.toFixed(2)} />
          <StatCard icon={Timer} label="Compile time" value={formatDuration(totals.ms)} />
          <StatCard icon={Cpu} label="Failures" value={String(totals.failures)} />
        </div>

        <Input
          placeholder="Filter by architecture, platform, status or command…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        <Tabs defaultValue="by-arch">
          <TabsList>
            <TabsTrigger value="by-arch">By architecture</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>

          <TabsContent value="by-arch" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost per architecture</CardTitle>
                <CardDescription>Ledger-backed credits, average compile time and failure rate.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Target</th>
                      <th>Multiplier</th>
                      <th>Runs</th>
                      <th>Credits</th>
                      <th>Avg time</th>
                      <th>Failures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byArch.map((row) => (
                      <tr key={row.arch} className="border-t border-border/50">
                        <td className="py-2 font-medium text-foreground">{archLabel(row.arch)}</td>
                        <td className="text-muted-foreground">×{archMultiplier(row.arch)}</td>
                        <td className="text-muted-foreground">{row.runs}</td>
                        <td className="text-primary">{row.credits.toFixed(2)}</td>
                        <td className="text-muted-foreground">{formatDuration(Math.round(row.ms / row.runs))}</td>
                        <td className={row.failures ? "text-destructive" : "text-muted-foreground"}>{row.failures}</td>
                      </tr>
                    ))}
                    {byArch.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                          No builds yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="mt-4 space-y-2">
            {filtered.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-4 py-3 text-left transition hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {b.kind} · {archLabel(b.arch)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{b.command ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Badge variant="outline" className={cn(STATUS_STYLES[b.status] ?? "")}>{b.status}</Badge>
                  <span className="text-muted-foreground">{formatDuration(b.duration_ms)}</span>
                  <span className="text-primary">{Number(b.credits_spent).toFixed(2)} cr</span>
                  <span className="text-muted-foreground">{new Date(b.created_at).toLocaleString()}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="py-6 text-center text-muted-foreground">No builds yet.</p>}
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-orbitron">
              {selected ? `${selected.kind} · ${archLabel(selected.arch)}` : "Build"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className={cn(STATUS_STYLES[selected.status] ?? "")}>{selected.status}</Badge>
                <span>Compile time: {formatDuration(selected.duration_ms)}</span>
                <span>Cost: {Number(selected.credits_spent).toFixed(2)} credits</span>
                <span>Session: {selected.session_id.slice(0, 8)}</span>
              </div>
              {selected.error_message && <p className="text-sm text-destructive">{selected.error_message}</p>}
              <pre className="max-h-96 overflow-auto rounded-lg bg-muted/40 p-4 font-mono text-xs text-muted-foreground">
                {selected.logs?.trim() || "No logs captured."}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <p className="font-orbitron text-lg text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
