import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Cloud, Coins, Hammer, Loader2, RefreshCw, Timer, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  container_ref: string;
  billed_minutes: number;
  credits_spent: number;
  started_at: string;
  last_activity_at: string;
  terminated_at: string | null;
}

interface BuildRow {
  id: string;
  session_id: string;
  user_id: string;
  kind: string;
  status: string;
  command: string | null;
  credits_spent: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  starting: "border-amber-500/30 text-amber-400",
  running: "border-emerald-500/30 text-emerald-400",
  succeeded: "border-emerald-500/30 text-emerald-400",
  idle: "border-border text-muted-foreground",
  queued: "border-border text-muted-foreground",
  failed: "border-destructive/30 text-destructive",
  terminated: "border-destructive/30 text-destructive",
};

export default function AdminCloudPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setBusy(true);
    const [s, b] = await Promise.all([
      supabase.from("cloud_sessions").select("*").order("started_at", { ascending: false }).limit(200),
      supabase.from("session_builds").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setSessions((s.data ?? []) as SessionRow[]);
    setBuilds((b.data ?? []) as BuildRow[]);
    setBusy(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin-cloud-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cloud_sessions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "session_builds" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.status !== "terminated");
    return {
      active: active.length,
      total: sessions.length,
      minutes: sessions.reduce((sum, s) => sum + (s.billed_minutes ?? 0), 0),
      credits: sessions.reduce((sum, s) => sum + Number(s.credits_spent ?? 0), 0),
      buildsRunning: builds.filter((b) => b.status === "running").length,
      buildsFailed: builds.filter((b) => b.status === "failed").length,
    };
  }, [sessions, builds]);

  const q = search.trim().toLowerCase();
  const filteredSessions = sessions.filter(
    (s) => !q || s.user_id.includes(q) || s.project_id.includes(q) || s.status.includes(q),
  );
  const filteredBuilds = builds.filter(
    (b) => !q || b.user_id.includes(q) || (b.command ?? "").toLowerCase().includes(q) || b.status.includes(q),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/40 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/admin" aria-label="Back to admin">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-orbitron text-lg font-bold">Cloud Sessions</h1>
              <p className="text-xs text-muted-foreground">Live containers, credit burn and builds</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { label: "Active sessions", value: stats.active, sub: `${stats.total} total`, icon: Cloud },
            { label: "Billed minutes", value: stats.minutes, sub: "all sessions", icon: Timer },
            { label: "Credits spent", value: stats.credits.toFixed(2), sub: "session ledger", icon: Coins },
            {
              label: "Builds",
              value: builds.length,
              sub: `${stats.buildsRunning} running · ${stats.buildsFailed} failed`,
              icon: Hammer,
            },
          ].map(({ label, value, sub, icon: Icon }) => (
            <Card key={label} className="border-border/50 bg-card/60 backdrop-blur">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Icon className="h-3.5 w-3.5 text-primary" /> {label}
                </CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">{sub}</CardContent>
            </Card>
          ))}
        </motion.div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by user, project, status or command…"
          className="max-w-md"
        />

        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">
              <Cloud className="mr-2 h-4 w-4" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="builds">
              <Activity className="mr-2 h-4 w-4" /> Builds
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-4">
            <Card className="divide-y divide-border/40 border-border/50 bg-card/60 backdrop-blur">
              {filteredSessions.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">No sessions yet.</p>
              )}
              {filteredSessions.map((s) => (
                <div key={s.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-mono">{s.id}</p>
                    <p className="truncate text-muted-foreground">
                      user {s.user_id.slice(0, 8)} · project {s.project_id.slice(0, 8)} · {s.container_ref}
                    </p>
                    <p className="text-muted-foreground">
                      started {new Date(s.started_at).toLocaleString()} · last activity{" "}
                      {new Date(s.last_activity_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="text-muted-foreground">{s.billed_minutes} min</span>
                    <span className="font-semibold">{Number(s.credits_spent).toFixed(2)} cr</span>
                    <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[s.status])}>
                      {s.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="builds" className="mt-4">
            <Card className="divide-y divide-border/40 border-border/50 bg-card/60 backdrop-blur">
              {filteredBuilds.length === 0 && <p className="p-6 text-sm text-muted-foreground">No builds yet.</p>}
              {filteredBuilds.map((b) => (
                <div key={b.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-mono">{b.command ?? b.kind}</p>
                    <p className="truncate text-muted-foreground">
                      user {b.user_id.slice(0, 8)} · session {b.session_id.slice(0, 8)} ·{" "}
                      {new Date(b.created_at).toLocaleString()}
                    </p>
                    {b.error_message && <p className="truncate text-destructive">{b.error_message}</p>}
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="text-muted-foreground">
                      {b.duration_ms ? `${Math.round(b.duration_ms / 100) / 10}s` : "—"}
                    </span>
                    <span className="font-semibold">{Number(b.credits_spent).toFixed(2)} cr</span>
                    <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[b.status])}>
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
