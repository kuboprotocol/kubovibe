import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Apple, Bell, Coins, Loader2, Play, Rocket, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ARCH_TARGETS, archLabel, estimateBuildCost } from "@/lib/buildTargets";

const IOS_TARGETS = ARCH_TARGETS.filter((t) => t.platform === "ios" || t.platform === "macos");

interface SessionRow {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  container_ref: string;
  billed_minutes: number;
  credits_spent: number;
  preview_url: string | null;
  started_at: string;
  last_activity_at: string;
}

interface BuildRow {
  id: string;
  session_id: string;
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
}

interface PushRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  status: string;
  error_reason: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  running: "border-amber-500/30 text-amber-400",
  starting: "border-amber-500/30 text-amber-400",
  succeeded: "border-emerald-500/30 text-emerald-400",
  delivered: "border-emerald-500/30 text-emerald-400",
  failed: "border-destructive/40 text-destructive",
  terminated: "border-destructive/40 text-destructive",
};

const formatDuration = (ms: number | null) => {
  if (!ms || ms <= 0) return "—";
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

/** Real iOS build console inside the admin panel: pick a project, spin up a remote
 * session, compile for a device target and receive the APNs alert on the iPhone. */
export default function AdminIosBuildPage() {
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [pushes, setPushes] = useState<PushRow[]>([]);
  const [arch, setArch] = useState("ios-arm64");
  const [command, setCommand] = useState("npm run build && npx cap sync ios && xcodebuild -scheme App");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<{ configured: boolean; devices: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, b, d] = await Promise.all([
      supabase.from("projects").select("id,title").order("created_at", { ascending: false }).limit(200),
      supabase.from("cloud_sessions").select("*").order("started_at", { ascending: false }).limit(50),
      supabase
        .from("session_builds")
        .select("*")
        .in("platform", ["ios", "macos"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("push_deliveries").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setProjects((p.data ?? []) as Array<{ id: string; title: string }>);
    setSessions((s.data ?? []) as unknown as SessionRow[]);
    setBuilds((b.data ?? []) as unknown as BuildRow[]);
    setPushes((d.data ?? []) as unknown as PushRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    void supabase.functions
      .invoke("push-notify", { body: { action: "status" } })
      .then(({ data }) => setPushStatus(data as { configured: boolean; devices: number }))
      .catch(() => setPushStatus(null));
  }, [load]);

  // Realtime build + push feed while a compilation is in flight.
  useEffect(() => {
    const channel = supabase
      .channel("admin-ios-build")
      .on("postgres_changes", { event: "*", schema: "public", table: "session_builds" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  const sessionBuilds = useMemo(
    () => builds.filter((b) => !sessionId || b.session_id === sessionId),
    [builds, sessionId],
  );

  const logStream = useMemo(
    () =>
      [...sessionBuilds]
        .reverse()
        .map((b) =>
          [
            `$ ${b.command ?? b.kind} — ${archLabel(b.arch)} — ${b.status} (${Number(b.credits_spent ?? 0).toFixed(2)} cr, ${formatDuration(b.duration_ms)})`,
            b.logs?.trim() || "(no output captured)",
            b.error_message ? `! ${b.error_message}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n"),
    [sessionBuilds],
  );

  const startSession = async () => {
    if (!projectId) return toast.error("Pick a project first");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloud-sessions", {
        body: { action: "create", project_id: projectId },
      });
      if (error) throw new Error(error.message);
      const payload = data as { error?: string; session?: SessionRow };
      if (payload?.error) throw new Error(payload.error);
      toast.success("Session started");
      await load();
      if (payload.session?.id) setSessionId(payload.session.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      toast.error(msg.includes("insufficient_credits") ? "Not enough credits" : "Could not start session");
    } finally {
      setBusy(false);
    }
  };

  const run = async (kind: "build" | "deploy") => {
    if (!sessionId) return toast.error("Select a session");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloud-sessions", {
        body: { action: kind, session_id: sessionId, command: kind === "build" ? command : undefined, arch },
      });
      if (error) throw new Error(error.message);
      const payload = data as { error?: string; build?: BuildRow; charged?: number };
      if (payload?.error) throw new Error(payload.error);
      if (payload.build?.status === "succeeded") {
        toast.success(`${kind} finished · ${payload.charged} credits`);
      } else {
        toast.error(payload.build?.error_message ?? `${kind} failed`);
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      toast.error(msg.includes("insufficient_credits") ? "Not enough credits" : `Could not run ${kind}`);
    } finally {
      setBusy(false);
    }
  };

  const sendTestPush = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-notify", {
        body: {
          kind: "test",
          title: "KUBO Vibe",
          body: "Test alert — your iPhone is wired to the build pipeline.",
          data: { deeplink: "kubovibe://m" },
        },
      });
      if (error) throw new Error(error.message);
      const payload = data as { ok?: boolean; sent?: number; error?: string; failed?: string[] };
      if (payload?.error === "apns_not_configured") throw new Error("APNs secrets missing");
      if (payload?.ok) toast.success(`Push sent to ${payload.sent} device(s)`);
      else toast.error(payload?.failed?.[0] ?? "No device registered");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Push failed");
    } finally {
      setBusy(false);
    }
  };

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
              <h1 className="font-orbitron text-2xl font-bold">iOS build console</h1>
              <p className="text-sm text-muted-foreground">
                Run a real device build and get the APNs alert on your iPhone without leaving the panel.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              pushStatus?.configured ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400",
            )}
          >
            <Bell className="mr-1 h-3 w-3" />
            APNs {pushStatus?.configured ? `ready · ${pushStatus.devices} device(s)` : "not configured"}
          </Badge>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Apple className="h-4 w-4 text-primary" /> Session
            </CardTitle>
            <CardDescription>
              Builds run inside an ephemeral container — 1 credit/min plus the target multiplier per run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <Button onClick={() => void startSession()} disabled={busy || !projectId}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Start session
              </Button>
              <select
                aria-label="Active session"
                value={sessionId ?? ""}
                onChange={(e) => setSessionId(e.target.value || null)}
                className="h-10 min-w-[240px] rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select running session…</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)} · {s.status} · {Number(s.credits_spent).toFixed(2)} cr
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Target architecture"
                value={arch}
                onChange={(e) => setArch(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {IOS_TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} (×{t.multiplier})
                  </option>
                ))}
              </select>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                aria-label="Build command"
                className="min-w-[280px] flex-1 font-mono text-xs"
              />
              <Button onClick={() => void run("build")} disabled={busy || !sessionId}>
                <Play className="mr-2 h-4 w-4" /> Build
              </Button>
              <Button variant="outline" onClick={() => void run("deploy")} disabled={busy || !sessionId}>
                <Rocket className="mr-2 h-4 w-4" /> Deploy
              </Button>
              <Button variant="outline" onClick={() => void sendTestPush()} disabled={busy}>
                <Bell className="mr-2 h-4 w-4" /> Test push
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              <Coins className="mr-1 inline h-3 w-3" />
              build {estimateBuildCost("build", arch)} · deploy {estimateBuildCost("deploy", arch)} credits on{" "}
              {archLabel(arch)}
              {activeSession ? ` · session billed ${Number(activeSession.credits_spent).toFixed(2)} cr` : ""}
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="push">Push deliveries</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="mt-4">
            <Card className="glass-card">
              <CardContent className="p-0">
                <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-muted-foreground">
                  {loading ? "loading…" : logStream || "No iOS builds yet."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="mt-4">
            <Card className="glass-card">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3">When</th>
                      <th className="p-3">Kind</th>
                      <th className="p-3">Target</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Time</th>
                      <th className="p-3">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionBuilds.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          <Smartphone className="mx-auto mb-2 h-5 w-5" /> No runs yet.
                        </td>
                      </tr>
                    ) : (
                      sessionBuilds.map((b) => (
                        <tr key={b.id} className="border-b border-border/30">
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(b.created_at).toLocaleString()}
                          </td>
                          <td className="p-3">{b.kind}</td>
                          <td className="p-3 text-muted-foreground">{archLabel(b.arch)}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={cn(STATUS_STYLES[b.status])}>
                              {b.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{formatDuration(b.duration_ms)}</td>
                          <td className="p-3 text-primary">{Number(b.credits_spent ?? 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="push" className="mt-4">
            <Card className="glass-card">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3">When</th>
                      <th className="p-3">Kind</th>
                      <th className="p-3">Alert</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pushes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          No pushes sent yet.
                        </td>
                      </tr>
                    ) : (
                      pushes.map((p) => (
                        <tr key={p.id} className="border-b border-border/30">
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleString()}
                          </td>
                          <td className="p-3">{p.kind}</td>
                          <td className="p-3 text-muted-foreground">
                            {p.title} — {p.body}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={cn(STATUS_STYLES[p.status])}>
                              {p.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-destructive">{p.error_reason ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
