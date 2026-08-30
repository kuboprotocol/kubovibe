import { useState } from "react";
import { Cloud, Play, Square, Smartphone, Terminal, Timer, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCloudSession } from "@/hooks/useCloudSession";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  starting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  idle: "bg-muted text-muted-foreground border-border",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

export function VibeCloudSessionPanel() {
  const { session, sessions, loading, start, terminate } = useCloudSession();
  const [projectId, setProjectId] = useState("");

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Cloud className="h-5 w-5 text-primary" />
              Remote Workspace Sessions
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Builds, terminal and deploys run inside ephemeral KUBO Cloud containers. Nothing is
              executed on the device — the mobile agent is a rich client for editor, chat, terminal
              and live preview.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1">
            <Smartphone className="h-3 w-3" /> iOS / iPadOS ready
          </Badge>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Project ID (UUID)"
            className="sm:max-w-sm"
          />
          <Button onClick={() => start(projectId)} disabled={loading || !projectId || !!session}>
            <Play className="mr-2 h-4 w-4" /> Start session
          </Button>
          {session && (
            <Button variant="destructive" onClick={() => terminate()} disabled={loading}>
              <Square className="mr-2 h-4 w-4" /> Terminate
            </Button>
          )}
        </div>
      </header>

      {session && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={Timer} label="Billed minutes" value={String(session.billed_minutes)} />
          <Stat icon={Coins} label="Credits spent" value={String(session.credits_spent)} />
          <Stat
            icon={Terminal}
            label="Terminal"
            value={session.terminal_url ? "Connected" : "Provisioning"}
          />
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="border-b border-border/40 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent sessions
        </div>
        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No remote sessions yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-muted-foreground">{s.project_id}</p>
                  <p className="text-xs text-muted-foreground/70">
                    {new Date(s.started_at).toLocaleString()} · {s.billed_minutes} min ·{" "}
                    {s.credits_spent} credits
                  </p>
                </div>
                <Badge variant="outline" className={cn("shrink-0", STATUS_STYLES[s.status])}>
                  {s.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
