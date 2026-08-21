import { useCallback, useMemo, useRef, useState } from "react";
import {
  Brain,
  FileCode2,
  FileEdit,
  GitCommit,
  Loader2,
  Plug,
  AlertTriangle,
  CheckCircle2,
  Send,
  Undo2,
  Eye,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { VibeChatMessage, VibeStep, VibeStepKind } from "@/lib/vibeCodeAgentTypes";

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vibe-code-agent`;

const STEP_ICON: Record<VibeStepKind, typeof Brain> = {
  thinking: Brain,
  plan: MessageSquare,
  read_file: FileCode2,
  edit_file: FileEdit,
  diff: Eye,
  commit: GitCommit,
  connector: Plug,
  message: MessageSquare,
  error: AlertTriangle,
  done: CheckCircle2,
};

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-border/60 bg-background/70 p-2 text-[11px] leading-relaxed font-mono">
      {diff.split("\n").map((line, i) => (
        <div
          key={i}
          className={
            line.startsWith("+")
              ? "text-emerald-400"
              : line.startsWith("-")
              ? "text-rose-400"
              : "text-muted-foreground"
          }
        >
          {line}
        </div>
      ))}
    </pre>
  );
}

export function VibeCodeAgentChat({ projectId }: { projectId?: string }) {
  const [messages, setMessages] = useState<VibeChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const pendingEdits = useMemo(() => {
    const last = messages[messages.length - 1];
    return (last?.steps ?? []).filter((s) => s.kind === "diff" && s.proposedContent);
  }, [messages]);

  const pushStep = useCallback((messageId: string, step: VibeStep) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const steps = [...(m.steps ?? [])];
        // Collapse a running step into its finished counterpart.
        const idx = steps.findIndex(
          (s) => s.status === "running" && s.kind === step.kind && s.title.split(" ").pop() === step.title.split(" ").pop(),
        );
        if (idx >= 0 && step.status !== "running") steps[idx] = { ...steps[idx], ...step, finishedAt: Date.now() };
        else steps.push(step);
        return { ...m, steps };
      }),
    );
  }, []);

  const runStream = useCallback(
    async (payload: Record<string, unknown>, assistantId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("You must be signed in to run the agent.");
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(AGENT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ projectId, ...payload }),
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => "");
        pushStep(assistantId, {
          id: crypto.randomUUID(),
          kind: "error",
          status: "failed",
          title: "Agent request failed",
          detail: text || `HTTP ${resp.status}`,
          startedAt: Date.now(),
        });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, "");
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            pushStep(assistantId, {
              id: crypto.randomUUID(),
              startedAt: Date.now(),
              ...evt,
            } as VibeStep);
          } catch {
            /* ignore partial frame */
          }
        }
      }
    },
    [projectId, pushStep],
  );

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || running) return;
    setInput("");
    setRunning(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: prompt, createdAt: Date.now() },
      { id: assistantId, role: "assistant", content: "", steps: [], createdAt: Date.now() },
    ]);

    try {
      await runStream({ prompt, mode: autoApply ? "apply" : "preview" }, assistantId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const applyPending = async () => {
    if (!pendingEdits.length || running) return;
    setRunning(true);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", steps: [], createdAt: Date.now() },
    ]);
    try {
      await runStream(
        {
          apply: pendingEdits.map((s) => ({ path: s.path!, content: s.proposedContent! })),
        },
        assistantId,
      );
      toast.success("Changes committed to GitHub.");
    } finally {
      setRunning(false);
    }
  };

  const revertStep = async (step: VibeStep) => {
    if (!step.commitSha || running) return;
    setRunning(true);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", steps: [], createdAt: Date.now() },
    ]);
    try {
      await runStream({ revertSha: step.commitSha }, assistantId);
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          steps: (m.steps ?? []).map((s) => (s.id === step.id ? { ...s, reverted: true } : s)),
        })),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="flex h-full flex-col bg-card/60 backdrop-blur border-border/60">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Vibe Code Agent</h2>
          <p className="text-xs text-muted-foreground">Prompt in, real commit out — step by step.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="auto-apply" className="text-xs text-muted-foreground">
            Auto-commit
          </Label>
          <Switch id="auto-apply" checked={autoApply} onCheckedChange={setAutoApply} />
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-5">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Describe a change — the agent plans it, previews the diff, and commits it to your repository.
            </p>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-2">
                {(m.steps ?? []).map((step) => {
                  const Icon = STEP_ICON[step.kind] ?? Brain;
                  return (
                    <div
                      key={step.id}
                      className="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {step.status === "running" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <Icon
                            className={`h-3.5 w-3.5 ${
                              step.status === "failed" ? "text-destructive" : "text-primary"
                            }`}
                          />
                        )}
                        <span className="text-sm">{step.title}</span>
                        {step.commitSha && (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {step.commitSha.slice(0, 7)}
                          </Badge>
                        )}
                        {step.reverted && (
                          <Badge variant="secondary" className="text-[10px]">
                            reverted
                          </Badge>
                        )}
                        {step.commitSha && !step.reverted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-6 px-2 text-[11px]"
                            onClick={() => revertStep(step)}
                            disabled={running}
                          >
                            <Undo2 className="mr-1 h-3 w-3" /> Undo
                          </Button>
                        )}
                      </div>
                      {step.detail && (
                        <p className="mt-1 pl-6 text-xs text-muted-foreground">{step.detail}</p>
                      )}
                      {step.diff && <DiffView diff={step.diff} />}
                    </div>
                  );
                })}
              </div>
            ),
          )}
        </div>
      </ScrollArea>

      {pendingEdits.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {pendingEdits.length} file(s) previewed and ready to commit
          </span>
          <Button size="sm" onClick={applyPending} disabled={running}>
            Apply changes
          </Button>
        </div>
      )}

      <div className="border-t border-border/60 p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="e.g. Add a dark hero section to the landing page"
            className="min-h-[52px] resize-none text-sm"
            disabled={running}
          />
          <Button onClick={() => void send()} disabled={running || !input.trim()} className="h-[52px]">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default VibeCodeAgentChat;
