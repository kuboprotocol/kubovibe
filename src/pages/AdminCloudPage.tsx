import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Cloud,
  Coins,
  Hammer,
  Loader2,
  RefreshCw,
  Timer,
  Activity,
  FolderKanban,
  Rocket,
  Play,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminSessionWindow } from "@/components/admin/AdminSessionWindow";

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
  project_id: string | null;
  logs: string | null;
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

interface ProjectUsage {
  projectId: string;
  title: string;
  sessions: number;
  activeSessions: number;
  minutes: number;
  sessionCredits: number;
  buildCredits: number;
  deployCredits: number;
  builds: number;
  deploys: number;
  failed: number;
  total: number;
  lastActivity: string;
}

export default function AdminCloudPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [runningOn, setRunningOn] = useState<string | null>(null);
  const [command, setCommand] = useState("npm run build");
  const [logBuild, setLogBuild] = useState<BuildRow | null>(null);
  const [openProject, setOpenProject] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);


  const load = async () => {
    setBusy(true);
    const [s, b, p] = await Promise.all([
      supabase.from("cloud_sessions").select("*").order("started_at", { ascending: false }).limit(200),
      supabase.from("session_builds").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("projects").select("id,title").limit(500),
    ]);
    setSessions((s.data ?? []) as SessionRow[]);
    setBuilds((b.data ?? []) as BuildRow[]);
    setTitles(
      Object.fromEntries(((p.data ?? []) as Array<{ id: string; title: string }>).map((r) => [r.id, r.title])),
    );
    setBusy(false);
  };

  /** Runs a real build/deploy inside the container of the selected session. */
  const runOnSession = async (sessionId: string, kind: "build" | "deploy") => {
    setRunningOn(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke("cloud-sessions", {
        body: { action: kind, session_id: sessionId, command: kind === "build" ? command : undefined },
      });
      if (error) throw new Error(error.message);
      const payload = data as { error?: string; build?: BuildRow };
      if (payload?.error) throw new Error(payload.error);
      if (payload.build) setLogBuild(payload.build);
      toast[payload.build?.status === "succeeded" ? "success" : "error"](
        `${kind} ${payload.build?.status ?? "finished"}`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not run ${kind}`);
    } finally {
      setRunningOn(null);
    }
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

  const projectUsage = useMemo<ProjectUsage[]>(() => {
    const map = new Map<string, ProjectUsage>();
    const ensure = (id: string): ProjectUsage => {
      let row = map.get(id);
      if (!row) {
        row = {
          projectId: id,
          title: titles[id] ?? `project ${id.slice(0, 8)}`,
          sessions: 0,
          activeSessions: 0,
          minutes: 0,
          sessionCredits: 0,
          buildCredits: 0,
          deployCredits: 0,
          builds: 0,
          deploys: 0,
          failed: 0,
          total: 0,
          lastActivity: "",
        };
        map.set(id, row);
      }
      return row;
    };

    for (const s of sessions) {
      const row = ensure(s.project_id);
      row.sessions += 1;
      if (s.status !== "terminated") row.activeSessions += 1;
      row.minutes += s.billed_minutes ?? 0;
      // Session credits already include build/deploy charges, so container time is the remainder.
      row.sessionCredits += Number(s.credits_spent ?? 0);
      if (s.last_activity_at > row.lastActivity) row.lastActivity = s.last_activity_at;
    }

    const sessionProject = new Map(sessions.map((s) => [s.id, s.project_id]));
    for (const b of builds) {
      const id = b.project_id ?? sessionProject.get(b.session_id);
      if (!id) continue;
      const row = ensure(id);
      const credits = Number(b.credits_spent ?? 0);
      if (b.kind === "deploy") {
        row.deploys += 1;
        row.deployCredits += credits;
      } else {
        row.builds += 1;
        row.buildCredits += credits;
      }
      if (b.status === "failed") row.failed += 1;
    }

    for (const row of map.values()) {
      // Container time = total session burn minus the fixed build/deploy charges.
      const containerCredits = Math.max(0, row.sessionCredits - row.buildCredits - row.deployCredits);
      row.sessionCredits = containerCredits;
      row.total = containerCredits + row.buildCredits + row.deployCredits;
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [sessions, builds, titles]);

  const projectHistory = useMemo(() => {
    if (!openProject) return [] as BuildRow[];
    const sessionProject = new Map(sessions.map((s) => [s.id, s.project_id]));
    return builds.filter((b) => (b.project_id ?? sessionProject.get(b.session_id)) === openProject);
  }, [openProject, builds, sessions]);

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

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="npm run build"
            className="max-w-xs font-mono text-xs"
          />
          <span className="text-[11px] text-muted-foreground">
            Command used by the Build action below · build 2 cr · deploy 4 cr, charged to the session owner.
          </span>
        </div>

        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">
              <Cloud className="mr-2 h-4 w-4" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="builds">
              <Activity className="mr-2 h-4 w-4" /> Builds
            </TabsTrigger>
            <TabsTrigger value="projects">
              <FolderKanban className="mr-2 h-4 w-4" /> Projects
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
                    <button className="truncate font-mono hover:text-primary" onClick={() => setOpenSession(s.id)}>
                      {s.id}
                    </button>

                    <p className="truncate text-muted-foreground">
                      user {s.user_id.slice(0, 8)} · project {s.project_id.slice(0, 8)} · {s.container_ref}
                    </p>
                    <p className="text-muted-foreground">
                      started {new Date(s.started_at).toLocaleString()} · last activity{" "}
                      {new Date(s.last_activity_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="text-muted-foreground">{s.billed_minutes} min</span>
                    <span className="font-semibold">{Number(s.credits_spent).toFixed(2)} cr</span>
                    <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[s.status])}>
                      {s.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px]"
                      disabled={s.status === "terminated" || runningOn === s.id}
                      onClick={() => void runOnSession(s.id, "build")}
                    >
                      {runningOn === s.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      Build
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px]"
                      disabled={s.status === "terminated" || runningOn === s.id}
                      onClick={() => void runOnSession(s.id, "deploy")}
                    >
                      <Rocket className="mr-1 h-3 w-3" /> Deploy
                    </Button>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setLogBuild(b)}
                    >
                      <Terminal className="mr-1 h-3 w-3" /> Logs
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="mt-4 space-y-4">
            <Card className="border-border/50 bg-card/60 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cost per project</CardTitle>
                <CardDescription className="text-xs">
                  Container time, build and deploy credits attributed to each project. Sorted by
                  total burn — the most expensive projects appear first.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-[10px] uppercase text-muted-foreground">
                      <tr className="border-b border-border/40">
                        <th className="px-4 py-2">Project</th>
                        <th className="px-2 py-2">Sessions</th>
                        <th className="px-2 py-2">Minutes</th>
                        <th className="px-2 py-2">Container</th>
                        <th className="px-2 py-2">Builds</th>
                        <th className="px-2 py-2">Deploys</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectUsage.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                            No usage recorded yet.
                          </td>
                        </tr>
                      )}
                      {projectUsage
                        .filter((p) => !q || p.title.toLowerCase().includes(q) || p.projectId.includes(q))
                        .map((p) => (
                          <tr
                            key={p.projectId}
                            onClick={() => setOpenProject(p.projectId === openProject ? null : p.projectId)}
                            className={cn(
                              "cursor-pointer border-b border-border/20 hover:bg-muted/30",
                              openProject === p.projectId && "bg-muted/30",
                            )}
                          >
                            <td className="px-4 py-2">
                              <p className="font-medium">{p.title}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {p.projectId.slice(0, 8)}
                                {p.activeSessions > 0 && ` · ${p.activeSessions} active`}
                                {p.failed > 0 && ` · ${p.failed} failed`}
                              </p>
                            </td>
                            <td className="px-2 py-2 text-muted-foreground">{p.sessions}</td>
                            <td className="px-2 py-2 text-muted-foreground">{p.minutes}</td>
                            <td className="px-2 py-2">{p.sessionCredits.toFixed(2)} cr</td>
                            <td className="px-2 py-2">
                              {p.buildCredits.toFixed(2)} cr
                              <span className="text-muted-foreground"> ·{p.builds}</span>
                            </td>
                            <td className="px-2 py-2">
                              {p.deployCredits.toFixed(2)} cr
                              <span className="text-muted-foreground"> ·{p.deploys}</span>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold">{p.total.toFixed(2)} cr</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {openProject && (
              <Card className="border-border/50 bg-card/60 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Credit history</CardTitle>
                  <CardDescription className="text-xs">
                    Every billed build and deploy for {titles[openProject] ?? openProject.slice(0, 8)}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/30 px-0 pb-0">
                  {projectHistory.length === 0 && (
                    <p className="px-6 py-4 text-xs text-muted-foreground">No billed runs yet.</p>
                  )}
                  {projectHistory.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setLogBuild(b)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[11px] hover:bg-muted/30"
                    >
                      <span className="min-w-0 truncate font-mono">{b.command ?? b.kind}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-muted-foreground">
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                        <span className="font-semibold">-{Number(b.credits_spent).toFixed(2)} cr</span>
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[b.status])}>
                          {b.status}
                        </Badge>
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <AdminSessionWindow
          session={sessions.find((s) => s.id === openSession) ?? null}
          builds={builds}
          projectTitle={titles[sessions.find((s) => s.id === openSession)?.project_id ?? ""]}
          running={runningOn === openSession}
          onClose={() => setOpenSession(null)}
          onRun={(id, kind) => void runOnSession(id, kind)}
        />

        <Dialog open={!!logBuild} onOpenChange={(open) => !open && setLogBuild(null)}>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">
                {logBuild?.kind} · {logBuild?.status} · {Number(logBuild?.credits_spent ?? 0).toFixed(2)} cr
              </DialogTitle>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-black/60 p-3 font-mono text-[11px] text-emerald-300">
              {logBuild?.logs || "No logs captured."}
            </pre>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
