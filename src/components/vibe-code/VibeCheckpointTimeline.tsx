import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, Loader2, GitCommit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { VibeCheckpoint } from "@/lib/vibeCodeAgentTypes";

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vibe-code-agent`;

/**
 * Lista todos os checkpoints (ciclos de commit) do projeto atual, mais
 * recentes primeiro, com botão de rollback de 1 clique para qualquer ponto
 * anterior — não só "desfazer última ação".
 */
export function VibeCheckpointTimeline({ projectRepo }: { projectRepo?: string }) {
  const [checkpoints, setCheckpoints] = useState<VibeCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("vibe_checkpoints")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data, error } = projectRepo ? await query.eq("project_repo", projectRepo) : await query;
    if (!error) setCheckpoints((data ?? []) as VibeCheckpoint[]);
    setLoading(false);
  }, [projectRepo]);

  useEffect(() => {
    void load();
  }, [load]);

  const revert = async (checkpoint: VibeCheckpoint) => {
    setRevertingId(checkpoint.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Faça login para reverter.");
        return;
      }
      const resp = await fetch(AGENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ revertCheckpointId: checkpoint.id }),
      });
      if (!resp.ok || !resp.body) {
        toast.error("Falha ao reverter checkpoint.");
        return;
      }
      // Drena o stream SSE até o fim (a UI de progresso vive no chat principal).
      const reader = resp.body.getReader();
      while (!(await reader.read()).done) {
        /* consumir */
      }
      toast.success(`Revertido para o checkpoint de ${new Date(checkpoint.created_at).toLocaleString("pt-BR")}`);
      await load();
    } catch {
      toast.error("Falha ao reverter checkpoint.");
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-border/30 bg-[#0a0a0a]/60">
      <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2.5">
        <History className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/80">Checkpoints</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2.5">
          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {!loading && checkpoints.length === 0 && (
            <p className="px-1 py-4 text-center text-[11px] text-muted-foreground/60">
              Nenhum checkpoint ainda — aplique uma mudança para começar a timeline.
            </p>
          )}

          {checkpoints.map((cp) => (
            <div
              key={cp.id}
              className="group rounded-lg border border-border/30 bg-card/30 p-2.5 transition-colors hover:bg-card/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <GitCommit className="h-3 w-3 shrink-0 text-primary/70" />
                  <p className="truncate text-[11px] font-medium text-foreground/85" title={cp.summary}>
                    {cp.summary}
                  </p>
                </div>
                <Badge variant="outline" className="h-4 shrink-0 rounded-md border-primary/20 px-1 text-[8px] font-mono text-primary/80">
                  {cp.commit_sha.slice(0, 7)}
                </Badge>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground/60">
                <span>{new Date(cp.created_at).toLocaleString("pt-BR")}</span>
                <span>
                  {cp.model_used ? `${cp.model_used} · ` : ""}
                  {cp.credits_spent} crédito{cp.credits_spent === 1 ? "" : "s"}
                </span>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="mt-1.5 h-6 w-full gap-1.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                onClick={() => void revert(cp)}
                disabled={revertingId !== null}
              >
                {revertingId === cp.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Reverter para aqui
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default VibeCheckpointTimeline;
