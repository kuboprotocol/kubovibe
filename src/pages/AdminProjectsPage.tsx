import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, FolderKanban, Hammer, Loader2, RefreshCw, Rocket, Search, Sparkles, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface BuildRow {
  id: string;
  project_id: string | null;
  kind: string;
  status: string;
  credits_spent: number;
  command: string | null;
  created_at: string;
}

interface ProjectRow {
  id: string;
  title: string;
  builds: number;
  deploys: number;
  failed: number;
  buildCredits: number;
  deployCredits: number;
  containerCredits: number;
  aiCredits: number;
  total: number;
  last30: number;
  projected: number;
  lastActivity: string | null;
}

interface DayRow {
  day: string;
  containerMinutes: number;
  containerCredits: number;
  buildCredits: number;
  deployCredits: number;
  aiCredits: number;
  total: number;
}

const STATUS_STYLE: Record<string, string> = {
  succeeded: "border-emerald-500/30 text-emerald-400",
  running: "border-amber-500/30 text-amber-400",
  queued: "border-border text-muted-foreground",
  failed: "border-destructive/30 text-destructive",
};

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);


  const load = async () => {
    setBusy(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [projectsRes, buildsRes, txRes, sessionsRes] = await Promise.all([
      supabase.from("projects").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(500),
      supabase
        .from("session_builds")
        .select("id, project_id, kind, status, credits_spent, command, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("credit_transactions").select("delta, category, metadata, created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("cloud_sessions").select("project_id, credits_spent, billed_minutes, started_at").limit(2000),
    ]);

    const buildRows = (buildsRes.data ?? []) as BuildRow[];
    setBuilds(buildRows);

    const aiByProject = new Map<string, number>();
    (txRes.data ?? []).forEach((t) => {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      const pid = typeof meta.project_id === "string" ? meta.project_id : null;
      if (!pid || Number(t.delta) >= 0) return;
      aiByProject.set(pid, (aiByProject.get(pid) ?? 0) + Math.abs(Number(t.delta)));
    });

    const aiLast30 = new Map<string, number>();
    (txRes.data ?? []).forEach((t) => {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      const pid = typeof meta.project_id === "string" ? meta.project_id : null;
      if (!pid || Number(t.delta) >= 0 || t.created_at < since) return;
      aiLast30.set(pid, (aiLast30.get(pid) ?? 0) + Math.abs(Number(t.delta)));
    });

    const containerByProject = new Map<string, number>();
    const containerLast30 = new Map<string, number>();
    (sessionsRes.data ?? []).forEach((s2) => {
      const credits = Number(s2.credits_spent ?? 0);
      containerByProject.set(s2.project_id, (containerByProject.get(s2.project_id) ?? 0) + credits);
      if (s2.started_at >= since) containerLast30.set(s2.project_id, (containerLast30.get(s2.project_id) ?? 0) + credits);
    });

    const rows: ProjectRow[] = (projectsRes.data ?? []).map((p) => {
      const own = buildRows.filter((b) => b.project_id === p.id);
      const buildCredits = own.filter((b) => b.kind === "build").reduce((a, b) => a + Number(b.credits_spent ?? 0), 0);
      const deployCredits = own.filter((b) => b.kind === "deploy").reduce((a, b) => a + Number(b.credits_spent ?? 0), 0);
      const containerCredits = containerByProject.get(p.id) ?? 0;
      const aiCredits = aiByProject.get(p.id) ?? 0;
      const actionsLast30 = own
        .filter((b) => b.created_at >= since)
        .reduce((a, b) => a + Number(b.credits_spent ?? 0), 0);
      const last30 = actionsLast30 + (aiLast30.get(p.id) ?? 0) + (containerLast30.get(p.id) ?? 0);
      return {
        id: p.id,
        title: p.title,
        builds: own.filter((b) => b.kind === "build").length,
        deploys: own.filter((b) => b.kind === "deploy").length,
        failed: own.filter((b) => b.status === "failed").length,
        buildCredits,
        deployCredits,
        containerCredits,
        aiCredits,
        total: buildCredits + deployCredits + containerCredits + aiCredits,
        last30,
        projected: last30,
        lastActivity: own[0]?.created_at ?? p.updated_at,
      };
    });

    rows.sort((a, b) => b.total - a.total);
    setProjects(rows);

    const dayMap = new Map<string, DayRow>();
    const touch = (iso: string) => {
      const key = dayKey(iso);
      let row = dayMap.get(key);
      if (!row) {
        row = { day: key, containerMinutes: 0, containerCredits: 0, buildCredits: 0, deployCredits: 0, aiCredits: 0, total: 0 };
        dayMap.set(key, row);
      }
      return row;
    };

    (sessionsRes.data ?? []).forEach((s2) => {
      const row = touch(s2.started_at);
      row.containerMinutes += Number(s2.billed_minutes ?? 0);
      row.containerCredits += Number(s2.credits_spent ?? 0);
    });

    buildRows.forEach((b) => {
      const row = touch(b.created_at);
      const credits = Number(b.credits_spent ?? 0);
      if (b.kind === "deploy") row.deployCredits += credits;
      else row.buildCredits += credits;
    });

    (txRes.data ?? []).forEach((t) => {
      const delta = Number(t.delta);
      if (delta >= 0) return;
      touch(t.created_at).aiCredits += Math.abs(delta);
    });

    const dayRows = Array.from(dayMap.values())
      .map((d) => ({ ...d, total: d.containerCredits + d.buildCredits + d.deployCredits + d.aiCredits }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
    setDays(dayRows);

    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.title.toLowerCase().includes(q) || p.id.includes(q));
  }, [projects, search]);

  const history = useMemo(() => (selected ? builds.filter((b) => b.project_id === selected) : []), [builds, selected]);

  const dailyProjection = useMemo(() => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recent = days.filter((d) => d.day >= since);
    const span = Math.max(recent.length, 1);
    const sum = (pick: (d: DayRow) => number) => recent.reduce((a, d) => a + pick(d), 0);
    const factor = 30 / span;
    return {
      minutes: sum((d) => d.containerMinutes) * factor,
      container: sum((d) => d.containerCredits) * factor,
      build: sum((d) => d.buildCredits) * factor,
      deploy: sum((d) => d.deployCredits) * factor,
      ai: sum((d) => d.aiCredits) * factor,
      total: sum((d) => d.total) * factor,
    };
  }, [days]);

  const totals = useMemo(

    () => ({
      builds: projects.reduce((a, p) => a + p.builds, 0),
      deploys: projects.reduce((a, p) => a + p.deploys, 0),
      credits: projects.reduce((a, p) => a + p.total, 0),
      projected: projects.reduce((a, p) => a + p.projected, 0),
    }),
    [projects],
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/admin" aria-label="Back to admin">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-orbitron text-2xl font-bold">Projects</h1>
              <p className="text-sm text-muted-foreground">Container, build, deploy and AI credits per project, with a 30-day cost projection.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Builds", value: totals.builds, icon: Hammer },
            { label: "Deploys", value: totals.deploys, icon: Rocket },
            { label: "Credits billed", value: totals.credits.toFixed(1), icon: Sparkles },
            { label: "Projected / month", value: totals.projected.toFixed(1), icon: Sparkles },
          ].map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </CardDescription>
                <CardTitle className="text-2xl">{c.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList>
            <TabsTrigger value="projects">
              <FolderKanban className="mr-2 h-4 w-4" /> By project
            </TabsTrigger>
            <TabsTrigger value="daily">
              <CalendarDays className="mr-2 h-4 w-4" /> By day
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
        <Card>

          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" /> Cost by project
            </CardTitle>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search project" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Project</th>
                  <th className="text-right">Builds</th>
                  <th className="text-right">Deploys</th>
                  <th className="text-right">Failed</th>
                  <th className="text-right">Container</th>
                  <th className="text-right">Build</th>
                  <th className="text-right">Deploy</th>
                  <th className="text-right">AI</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Projected / mo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(selected === p.id ? null : p.id)}
                    className={cn("cursor-pointer border-t border-border/60 hover:bg-muted/40", selected === p.id && "bg-muted/50")}
                  >
                    <td className="py-2">
                      <div className="font-medium">{p.title}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{p.id.slice(0, 8)}</div>
                    </td>
                    <td className="text-right">{p.builds}</td>
                    <td className="text-right">{p.deploys}</td>
                    <td className="text-right">{p.failed}</td>
                    <td className="text-right">{p.containerCredits.toFixed(1)}</td>
                    <td className="text-right">{p.buildCredits.toFixed(1)}</td>
                    <td className="text-right">{p.deployCredits.toFixed(1)}</td>
                    <td className="text-right">{p.aiCredits.toFixed(1)}</td>
                    <td className="text-right font-semibold">{p.total.toFixed(1)}</td>
                    <td className="text-right text-primary">{p.projected.toFixed(1)}</td>
                  </tr>
                ))}
                {!busy && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-muted-foreground">
                      No projects found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action history</CardTitle>
              <CardDescription>Every build and deploy charged to this project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.length === 0 && <p className="text-sm text-muted-foreground">No actions recorded yet.</p>}
              {history.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {b.kind}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[b.status] ?? "")}>
                        {b.status}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{b.command ?? "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{Number(b.credits_spent ?? 0).toFixed(1)} cr</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
          </TabsContent>

          <TabsContent value="daily">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" /> Daily cost
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Timer className="h-3.5 w-3.5" /> Credits spent and container minutes per day, with a monthly projection from the last 30 days.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Day</th>
                      <th className="text-right">Container min</th>
                      <th className="text-right">Container</th>
                      <th className="text-right">Build</th>
                      <th className="text-right">Deploy</th>
                      <th className="text-right">AI</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.day} className="border-t border-border/60">
                        <td className="py-2 font-medium">{d.day}</td>
                        <td className="text-right">{d.containerMinutes.toFixed(0)}</td>
                        <td className="text-right">{d.containerCredits.toFixed(1)}</td>
                        <td className="text-right">{d.buildCredits.toFixed(1)}</td>
                        <td className="text-right">{d.deployCredits.toFixed(1)}</td>
                        <td className="text-right">{d.aiCredits.toFixed(1)}</td>
                        <td className="text-right font-semibold">{d.total.toFixed(1)}</td>
                      </tr>
                    ))}
                    {!busy && days.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          No usage recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {days.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-border">
                        <td className="py-2 font-semibold">Projected / month</td>
                        <td className="text-right text-primary">{dailyProjection.minutes.toFixed(0)}</td>
                        <td className="text-right text-primary">{dailyProjection.container.toFixed(1)}</td>
                        <td className="text-right text-primary">{dailyProjection.build.toFixed(1)}</td>
                        <td className="text-right text-primary">{dailyProjection.deploy.toFixed(1)}</td>
                        <td className="text-right text-primary">{dailyProjection.ai.toFixed(1)}</td>
                        <td className="text-right font-semibold text-primary">{dailyProjection.total.toFixed(1)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
