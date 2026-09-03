import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cloud, Download, Globe, Loader2, Monitor, RefreshCw, Smartphone, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLATFORMS, CLOUD_CREDIT_COSTS, billingFor, type PlatformSpec } from "@/lib/anywhereConfig";

const DAEMON_SLUG = "kubo-local-agent";

interface SessionRow {
  id: string;
  project_id: string;
  user_id: string;
  status: string;
  billed_minutes: number;
  credits_spent: number;
  last_activity_at: string;
}

interface DownloadLog {
  id: string;
  message: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface ProjectUsage {
  projectId: string;
  title: string;
  sessions: number;
  active: number;
  minutes: number;
  credits: number;
  lastActivity: string;
}

export default function AdminAnywherePage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [downloads, setDownloads] = useState<DownloadLog[]>([]);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    setBusy(true);
    const [sessionsRes, projectsRes, logsRes] = await Promise.all([
      supabase
        .from("cloud_sessions")
        .select("id, project_id, user_id, status, billed_minutes, credits_spent, last_activity_at")
        .order("last_activity_at", { ascending: false })
        .limit(1000),
      supabase.from("projects").select("id, title").limit(500),
      supabase
        .from("connector_activity_logs")
        .select("id, message, status, created_at, metadata")
        .eq("connector_slug", DAEMON_SLUG)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setSessions((sessionsRes.data ?? []) as SessionRow[]);
    setTitles(Object.fromEntries((projectsRes.data ?? []).map((p) => [p.id, p.title])));
    setDownloads((logsRes.data ?? []) as DownloadLog[]);
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const usage = useMemo<ProjectUsage[]>(() => {
    const map = new Map<string, ProjectUsage>();
    sessions.forEach((s) => {
      const row = map.get(s.project_id) ?? {
        projectId: s.project_id,
        title: titles[s.project_id] ?? s.project_id.slice(0, 8),
        sessions: 0,
        active: 0,
        minutes: 0,
        credits: 0,
        lastActivity: s.last_activity_at,
      };
      row.sessions += 1;
      if (["running", "starting", "idle"].includes(s.status)) row.active += 1;
      row.minutes += Number(s.billed_minutes ?? 0);
      row.credits += Number(s.credits_spent ?? 0);
      if (s.last_activity_at > row.lastActivity) row.lastActivity = s.last_activity_at;
      map.set(s.project_id, row);
    });
    return [...map.values()].sort((a, b) => b.credits - a.credits);
  }, [sessions, titles]);

  const handleDownload = async (platform: PlatformSpec) => {
    if (!platform.download) return;
    const { error } = await supabase.rpc("log_connector_activity", {
      _connector_slug: DAEMON_SLUG,
      _event_type: "download",
      _message: `Daemon download: ${platform.name}`,
      _status: "success",
      _metadata: { platform: platform.id, href: platform.download.href },
    });
    if (error) toast.error("Could not record the download");
    else void load();
    window.open(platform.download.href, "_blank", "noopener");
    toast.success(`${platform.name} daemon download started`);
  };

  const totals = useMemo(
    () => ({
      active: sessions.filter((s) => ["running", "starting", "idle"].includes(s.status)).length,
      minutes: sessions.reduce((a, s) => a + Number(s.billed_minutes ?? 0), 0),
      credits: sessions.reduce((a, s) => a + Number(s.credits_spent ?? 0), 0),
    }),
    [sessions],
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
              <h1 className="font-orbitron text-2xl font-bold">KUBO Anywhere</h1>
              <p className="text-sm text-muted-foreground">Cloud sessions, credit usage and Local Agent distribution.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active cloud sessions", value: totals.active, icon: Cloud },
            { label: "Container minutes", value: totals.minutes, icon: Timer },
            { label: "Credits spent", value: totals.credits.toFixed(1), icon: Globe },
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

        <Tabs defaultValue="downloads">
          <TabsList>
            <TabsTrigger value="downloads">Downloads</TabsTrigger>
            <TabsTrigger value="history">Download history</TabsTrigger>
            <TabsTrigger value="usage">Usage by project</TabsTrigger>
          </TabsList>

          <TabsContent value="downloads" className="mt-4 grid gap-4 md:grid-cols-2">
            {PLATFORMS.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {p.family === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                    {p.name}
                    <Badge variant="outline" className="ml-auto text-[10px] uppercase">
                      {p.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{p.client}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">{billingFor(p).description}</p>
                  {p.download ? (
                    <Button size="sm" className="w-full" onClick={() => void handleDownload(p)}>
                      <Download className="mr-2 h-4 w-4" />
                      {p.download.label}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Distributed through the app stores — billed at {CLOUD_CREDIT_COSTS.perMinute} credit per container minute.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="space-y-2 pt-6">
                {downloads.length === 0 && <p className="text-sm text-muted-foreground">No daemon downloads recorded yet.</p>}
                {downloads.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.message}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {String((d.metadata as { platform?: string } | null)?.platform ?? "unknown")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
            <Card>
              <CardContent className="overflow-x-auto pt-6">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Project</th>
                      <th className="text-right">Sessions</th>
                      <th className="text-right">Active</th>
                      <th className="text-right">Minutes</th>
                      <th className="text-right">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((u) => (
                      <tr key={u.projectId} className="border-t border-border/60">
                        <td className="py-2">
                          <div className="font-medium">{u.title}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{u.projectId.slice(0, 8)}</div>
                        </td>
                        <td className="text-right">{u.sessions}</td>
                        <td className="text-right">{u.active}</td>
                        <td className="text-right">{u.minutes}</td>
                        <td className="text-right font-semibold">{u.credits.toFixed(1)}</td>
                      </tr>
                    ))}
                    {!busy && usage.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No cloud sessions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
