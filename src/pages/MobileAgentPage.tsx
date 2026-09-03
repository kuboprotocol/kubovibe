import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  Play,
  Square,
  GitBranch,
  FileCode2,
  Terminal,
  Eye,
  Bell,
  Coins,
  Loader2,
  RefreshCw,
  Save,
  Hammer,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCloudSession } from "@/hooks/useCloudSession";
import { useGitRepo } from "@/hooks/useGitRepo";
import { useDeviceRegistration } from "@/hooks/useDeviceRegistration";
import { useSessionBuilds } from "@/hooks/useSessionBuilds";
import { useWorkspaceProject } from "@/hooks/useWorkspaceProject";
import { cn } from "@/lib/utils";

type Tab = "session" | "files" | "terminal" | "preview";

interface ProjectRow {
  id: string;
  title: string;
}

const TABS: Array<{ id: Tab; label: string; icon: typeof Cloud }> = [
  { id: "session", label: "Session", icon: Cloud },
  { id: "files", label: "Files", icon: FileCode2 },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "preview", label: "Preview", icon: Eye },
];

const STATUS_STYLES: Record<string, string> = {
  starting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  idle: "bg-muted text-muted-foreground border-border",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function MobileAgentPage() {
  const { user } = useAuth();
  const { session, loading: sessionLoading, start, terminate, refresh } = useCloudSession();
  const git = useGitRepo();
  const device = useDeviceRegistration();
  const builds = useSessionBuilds(session?.id);

  const workspace = useWorkspaceProject();
  const { projectId, repo, branch, projects, setProjectId, setRepo, setBranch } = workspace;

  const [tab, setTab] = useState<Tab>("session");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [commitMessage, setCommitMessage] = useState("chore: update from KUBO Mobile Agent");
  const [buildCommand, setBuildCommand] = useState("npm run build");

  useEffect(() => {
    if (!user) return;
    void workspace.loadProjects();
  }, [user, workspace.loadProjects]);

  useEffect(() => {
    void git.loadRepos();
  }, [git.loadRepos]);

  useEffect(() => {
    if (!repo) return;
    void git.loadTree(repo, branch);
    void git.loadCommits(repo, branch);
  }, [repo, branch]);

  const running = session && session.status !== "terminated";
  const uptime = useMemo(() => {
    if (!session) return "—";
    const mins = Math.max(1, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000));
    return `${mins} min`;
  }, [session]);

  const lastBuild = builds.builds[0] ?? null;
  const previewUrl = lastBuild?.preview_url ?? session?.preview_url ?? null;

  const openFile = async (path: string) => {
    const file = await git.readFile(repo, branch, path);
    if (!file) return;
    setOpenPath(file.path);
    setFileContent(file.content);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-orbitron text-base font-bold tracking-wide">KUBO Mobile Agent</h1>
            <p className="text-[11px] text-muted-foreground">
              {device.native ? `${device.platform} · push ${device.state}` : "Web preview of the iOS client"}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn("text-[10px] uppercase", STATUS_STYLES[session?.status ?? "terminated"])}
          >
            {session?.status ?? "offline"}
          </Badge>
        </div>
      </header>

      <main className="px-4 py-4">
        {tab === "session" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="space-y-3 border-border/50 bg-card/60 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Cloud className="h-4 w-4 text-primary" /> Remote container
              </div>
              <p className="text-xs text-muted-foreground">
                Nothing runs on this device. Sessions execute in an ephemeral KUBO Cloud container billed at
                1 credit per active minute, with a 15 minute idle timeout.
              </p>

              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-10 w-full rounded-md border border-border/60 bg-background/60 px-3 text-sm"
              >
                {projects.length === 0 && <option value="">No projects yet</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!projectId || sessionLoading || !!running}
                  onClick={() => start(projectId)}
                >
                  {sessionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Open session
                </Button>
                <Button variant="outline" disabled={!running || sessionLoading} onClick={() => terminate()}>
                  <Square className="mr-2 h-4 w-4" /> Stop
                </Button>
                <Button variant="ghost" size="icon" onClick={() => refresh()} aria-label="Refresh session">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {session && (
              <Card className="grid grid-cols-3 gap-3 border-border/50 bg-card/60 p-4 text-center backdrop-blur">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Uptime</p>
                  <p className="text-sm font-semibold">{uptime}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Billed</p>
                  <p className="text-sm font-semibold">{session.billed_minutes} min</p>
                </div>
                <div>
                  <p className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
                    <Coins className="h-3 w-3" /> Credits
                  </p>
                  <p className="text-sm font-semibold">{session.credits_spent}</p>
                </div>
              </Card>
            )}

            <Card className="flex items-center justify-between gap-3 border-border/50 bg-card/60 p-4 backdrop-blur">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Bell className="h-4 w-4 text-primary" /> Build notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  {device.native
                    ? `Push token ${device.state}`
                    : "Available inside the installed iOS/iPadOS app"}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={!device.native} onClick={() => device.register()}>
                Enable
              </Button>
            </Card>
          </motion.div>
        )}

        {tab === "files" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="space-y-3 border-border/50 bg-card/60 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <GitBranch className="h-4 w-4 text-primary" /> Repository
              </div>
              {git.connected === false ? (
                <p className="text-xs text-muted-foreground">
                  GitHub is not connected yet. Connect it from the Connectors hub to browse and commit files.
                </p>
              ) : (
                <>
                  <select
                    value={repo}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRepo(value);
                      const found = git.repos.find((r) => r.full_name === value);
                      setBranch(found?.default_branch ?? "main");
                      setOpenPath(null);
                    }}
                    className="h-10 w-full rounded-md border border-border/60 bg-background/60 px-3 text-sm"
                  >
                    <option value="">Select a repository…</option>
                    {git.repos.map((r) => (
                      <option key={r.id} value={r.full_name}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch" />
                </>
              )}
            </Card>

            {openPath ? (
              <Card className="space-y-3 border-border/50 bg-card/60 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-xs">{openPath}</p>
                  <Button size="sm" variant="ghost" onClick={() => setOpenPath(null)}>
                    Close
                  </Button>
                </div>
                <Textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="min-h-[280px] font-mono text-xs"
                  spellCheck={false}
                />
                <Input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} />
                <Button
                  className="w-full"
                  disabled={git.loading}
                  onClick={() => git.commitFile(repo, branch, openPath, fileContent, commitMessage)}
                >
                  {git.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Commit to {branch}
                </Button>
              </Card>
            ) : (
              <Card className="divide-y divide-border/40 border-border/50 bg-card/60 backdrop-blur">
                {git.files.length === 0 && (
                  <p className="p-4 text-xs text-muted-foreground">
                    {repo ? "No files loaded." : "Pick a repository to browse its files."}
                  </p>
                )}
                {git.files.slice(0, 200).map((f) => (
                  <button
                    key={f.sha + f.path}
                    onClick={() => openFile(f.path)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-mono text-xs hover:bg-muted/40"
                  >
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.path}</span>
                  </button>
                ))}
              </Card>
            )}
          </motion.div>
        )}

        {tab === "terminal" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="space-y-3 border-border/50 bg-card/60 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Terminal className="h-4 w-4 text-primary" /> Remote terminal
              </div>
              {session?.terminal_url ? (
                <iframe
                  title="Remote terminal"
                  src={session.terminal_url}
                  className="h-[420px] w-full rounded-lg border border-border/50 bg-black"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {running
                    ? "The container is provisioning its terminal endpoint."
                    : "Open a session to attach a terminal."}
                </p>
              )}
              <div className="rounded-lg border border-border/40 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
                <p>session: {session?.id ?? "—"}</p>
                <p>container: {session?.container_ref ?? "—"}</p>
                <p>repo: {repo || "—"}@{branch}</p>
              </div>
            </Card>
          </motion.div>
        )}

        {tab === "preview" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="space-y-3 border-border/50 bg-card/60 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Hammer className="h-4 w-4 text-primary" /> Build &amp; deploy
                </div>
                <Badge variant="outline" className="text-[10px]">build 2 · deploy 4 credits</Badge>
              </div>
              <Input
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!running || builds.running}
                  onClick={() => builds.run("build", buildCommand)}
                >
                  {builds.running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hammer className="mr-2 h-4 w-4" />}
                  Run build
                </Button>
                <Button
                  variant="outline"
                  disabled={!running || builds.running}
                  onClick={() => builds.run("deploy")}
                >
                  <Rocket className="mr-2 h-4 w-4" /> Deploy
                </Button>
              </div>
              {!running && (
                <p className="text-xs text-muted-foreground">Open a session first — builds run inside the container.</p>
              )}
              {lastBuild && (
                <div className="space-y-2 rounded-lg border border-border/40 bg-background/60 p-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold uppercase">
                      {lastBuild.kind} · {lastBuild.status}
                    </span>
                    <span className="text-muted-foreground">
                      {lastBuild.duration_ms ? `${Math.round(lastBuild.duration_ms / 100) / 10}s` : "—"} ·{" "}
                      {lastBuild.credits_spent} cr
                    </span>
                  </div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                    {lastBuild.logs}
                  </pre>
                </div>
              )}
            </Card>

            <Card className="space-y-3 border-border/50 bg-card/60 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-primary" /> Live preview
              </div>
              {previewUrl ? (
                <iframe
                  title="Remote preview"
                  src={previewUrl}
                  className="h-[520px] w-full rounded-lg border border-border/50 bg-white"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {running ? "Run a build to publish the container preview." : "Open a session to see the live preview."}
                </p>
              )}
            </Card>

            {builds.builds.length > 1 && (
              <Card className="divide-y divide-border/40 border-border/50 bg-card/60 backdrop-blur">
                {builds.builds.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[11px]">
                    <span className="font-mono truncate">{b.command}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        b.status === "succeeded"
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-destructive/30 text-destructive",
                      )}
                    >
                      {b.status}
                    </Badge>
                  </div>
                ))}
              </Card>
            )}
          </motion.div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors",
              tab === id ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
