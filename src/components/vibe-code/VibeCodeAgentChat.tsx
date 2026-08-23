import { useCallback, useMemo, useRef, useState } from "react";
import {
  Brain,
  FileCode2,
  FileEdit,
  GitCommit,
  Loader2,
  Plug,
  AlertCircle,
  CheckCircle2,
  Send,
  Undo2,
  Eye,
  MessageSquare,
  ChevronRight,
  Bot,
  Rocket,
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
  error: AlertCircle,
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
    <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-[#080808]/80 backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between border-b border-border/40 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-[0_0_10px_rgba(201,148,26,0.2)]">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/90">Vibe Code Agent</h2>
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-medium text-muted-foreground/80">Active in Branch: main</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 border border-border/20">
            <Label htmlFor="auto-apply" className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
              Auto-Commit
            </Label>
            <Switch id="auto-apply" checked={autoApply} onCheckedChange={setAutoApply} className="scale-75" />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-6">
        <div className="relative ml-4 space-y-6 border-l border-border/10 pl-6">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Describe a change — the agent plans it, previews the diff, and commits it to your repository.
            </p>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end pb-4">
                <div className="max-w-[85%] rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-foreground shadow-lg shadow-primary/5">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-6">
                {(m.steps ?? []).map((step) => {
                  const Icon = STEP_ICON[step.kind] ?? Brain;
                  return (
                    <div
                      key={step.id}
                      className="group relative rounded-xl border border-border/40 bg-card/40 px-3 py-3 transition-all hover:bg-card/60"
                    >
                      <div className="absolute -left-[31px] top-4 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background shadow-[0_0_8px_rgba(201,148,26,0.4)]" />

                      <div className="flex items-center gap-2">
                        {step.status === "running" ? (
                          <div className="relative">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                          </div>
                        ) : (
                          <Icon
                            className={`h-4 w-4 ${
                              step.status === "failed" ? "text-rose-500" : "text-primary"
                            }`}
                          />
                        )}
                        <span className="text-sm font-medium tracking-tight text-foreground/90">
                          {step.title}
                        </span>
                        
                        {step.commitSha && (
                          <Badge variant="outline" className="h-4 rounded-md border-primary/20 bg-primary/5 px-1.5 text-[9px] font-mono text-primary uppercase">
                            {step.commitSha.slice(0, 7)}
                          </Badge>
                        )}
                        
                        {step.reverted && (
                          <Badge variant="secondary" className="h-4 rounded-md bg-rose-500/10 px-1.5 text-[9px] text-rose-500 uppercase">
                            reverted
                          </Badge>
                        )}
                        
                        {step.commitSha && !step.reverted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-6 gap-1.5 px-2 text-[10px] text-muted-foreground hover:text-primary"
                            onClick={() => revertStep(step)}
                            disabled={running}
                          >
                            <Undo2 className="h-3 w-3" /> Revert
                          </Button>
                        )}
                      </div>
                      
                      {step.detail && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-black/40 p-2 font-mono text-[10px] text-muted-foreground/80">
                          <span className="text-primary/60 mt-0.5">$</span>
                          <p className="leading-relaxed">{step.detail}</p>
                        </div>
                      )}
                      
                      {step.diff && (
                        <div className="mt-3">
                          <DiffView diff={step.diff} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ),
          )}
        </div>
      </ScrollArea>

      {pendingEdits.length > 0 && (
        <div className="flex animate-in fade-in slide-in-from-bottom-2 items-center justify-between border-t border-border/40 bg-primary/5 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Eye className="h-3 w-3" />
            </div>
            <span className="text-xs font-medium text-foreground/80">
              {pendingEdits.length} staged change{pendingEdits.length > 1 ? 's' : ''} ready
            </span>
          </div>
          <Button 
            size="sm" 
            onClick={applyPending} 
            disabled={running}
            className="h-8 gap-2 bg-primary px-4 text-xs font-bold uppercase text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            Deploy Changes <Rocket className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="border-t border-border/40 bg-white/[0.01] p-4">
        <div className="relative group">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask Vibe Agent to build, fix or refactor..."
            className="min-h-[60px] w-full resize-none border-border/20 bg-black/60 pl-3 pr-12 pt-3 text-xs font-medium placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
            disabled={running}
          />
          <Button 
            onClick={() => void send()} 
            disabled={running || !input.trim()} 
            size="icon"
            className="absolute bottom-2.5 right-2.5 h-8 w-8 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-[0_0_15px_rgba(201,148,26,0.1)]"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-center text-[9px] font-medium tracking-tight text-muted-foreground/40 uppercase">
          Agent executes real commits via GitHub API
        </p>
      </div>
    </Card>
  );
}

export default VibeCodeAgentChat;
