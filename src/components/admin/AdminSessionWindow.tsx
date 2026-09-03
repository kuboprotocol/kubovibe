import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Play, Rocket, Send, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SessionWindowSession {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  container_ref: string;
  billed_minutes: number;
  credits_spent: number;
  started_at: string;
  last_activity_at: string;
}

export interface SessionWindowBuild {
  id: string;
  session_id: string;
  kind: string;
  status: string;
  command: string | null;
  credits_spent: number;
  duration_ms: number | null;
  error_message: string | null;
  logs: string | null;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  session: SessionWindowSession | null;
  builds: SessionWindowBuild[];
  projectTitle?: string;
  running: boolean;
  onClose: () => void;
  onRun: (sessionId: string, kind: "build" | "deploy") => void;
}

const STATUS_STYLES: Record<string, string> = {
  running: "border-amber-500/30 text-amber-400",
  succeeded: "border-emerald-500/30 text-emerald-400",
  queued: "border-border text-muted-foreground",
  failed: "border-destructive/30 text-destructive",
};

/** Live session window: realtime build logs plus an AI assistant scoped to the session. */
export function AdminSessionWindow({ session, builds, projectTitle, running, onClose, onRun }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const sessionBuilds = useMemo(
    () => builds.filter((b) => b.session_id === session?.id),
    [builds, session?.id],
  );

  const logStream = useMemo(
    () =>
      [...sessionBuilds]
        .reverse()
        .map((b) =>
          [
            `$ ${b.command ?? b.kind} — ${b.status} (${Number(b.credits_spent ?? 0).toFixed(2)} cr)`,
            b.logs?.trim() || "(no output captured)",
            b.error_message ? `! ${b.error_message}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n"),
    [sessionBuilds],
  );

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logStream]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
  }, [session?.id]);

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt || !session) return;
    setDraft("");
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next);
    setThinking(true);
    try {
      const context = [
        `Session ${session.id} (${session.status}) on container ${session.container_ref}.`,
        `Project: ${projectTitle ?? session.project_id}.`,
        `Billed ${session.billed_minutes} min, ${Number(session.credits_spent).toFixed(2)} credits.`,
        `Recent build output:\n${logStream.slice(-4000) || "none"}`,
      ].join("\n");

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          language: "en",
          system: `You are the KUBO Cloud build assistant. Diagnose builds and suggest concrete commands. Context:\n${context}`,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw new Error(error.message);
      const payload = data as { error?: string; output?: { reply?: string } };
      if (payload?.error) throw new Error(payload.error);
      setMessages([...next, { role: "assistant", content: payload.output?.reply ?? "No reply." }]);
    } catch (err) {
      setMessages([
        ...next,
        { role: "assistant", content: err instanceof Error ? err.message : "Assistant unavailable." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" /> {projectTitle ?? session?.project_id.slice(0, 8)}
            {session && (
              <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[session.status])}>
                {session.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {session?.id} · {session?.billed_minutes} min ·{" "}
            {Number(session?.credits_spent ?? 0).toFixed(2)} cr
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px]"
                disabled={!session || session.status === "terminated" || running}
                onClick={() => session && onRun(session.id, "build")}
              >
                {running ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                Build
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px]"
                disabled={!session || session.status === "terminated" || running}
                onClick={() => session && onRun(session.id, "deploy")}
              >
                <Rocket className="mr-1 h-3 w-3" /> Deploy
              </Button>
              <span className="text-[10px] text-muted-foreground">{sessionBuilds.length} runs</span>
            </div>
            <div
              ref={logRef}
              className="h-[46vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-black/60 p-3 font-mono text-[11px] text-emerald-300"
            >
              {logStream || "Waiting for build output…"}
            </div>
          </div>

          <div className="flex h-[52vh] flex-col gap-2">
            <div className="flex-1 space-y-2 overflow-auto rounded-lg border border-border/40 p-3 text-xs">
              {messages.length === 0 && (
                <p className="text-muted-foreground">
                  Ask the assistant about this session — it reads the live build logs.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg px-3 py-2",
                    m.role === "user" ? "bg-primary/10" : "bg-muted/40",
                  )}
                >
                  <p className="mb-1 flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                    {m.role === "assistant" && <Bot className="h-3 w-3" />} {m.role}
                  </p>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
              {thinking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Why did this build fail?"
                className="text-xs"
              />
              <Button size="icon" className="h-9 w-9 shrink-0" disabled={thinking || !draft.trim()} onClick={() => void send()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
