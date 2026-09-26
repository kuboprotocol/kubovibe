import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Database, DollarSign, RefreshCw, XCircle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AI_TASK_LABEL, summarizeRuns, type AiGatewayRun, type AiTask } from "@/lib/aiGateway";
import { cn } from "@/lib/utils";

const RUN_COLUMNS =
  "id, project_id, task_kind, tier, provider, model, cached, status, error, prompt_tokens, completion_tokens, cost_usd, duration_ms, created_at";

function formatUsd(v: number) {
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Agent Activity: cada chamada ao KUBO AI Gateway (tarefa, modelo escolhido,
 * tokens, custo estimado, cache, duração). Atualiza em tempo real.
 */
export function VibeAgentActivityPanel({ projectId }: { projectId?: string }) {
  const [runs, setRuns] = useState<AiGatewayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("ai_gateway_runs" as never)
      .select(RUN_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error: err } = await query;
    setError(err ? "Não foi possível carregar a atividade." : null);
    setRuns(((data ?? []) as unknown) as AiGatewayRun[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("ai-gateway-runs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_gateway_runs" }, (payload) => {
        const row = payload.new as AiGatewayRun;
        if (projectId && row.project_id !== projectId) return;
        setRuns((prev) => [row, ...prev].slice(0, 50));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, projectId]);

  const totals = useMemo(() => summarizeRuns(runs), [runs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Agent Activity</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Zap} label="Execuções" value={String(totals.runs)} hint={totals.errors ? `${totals.errors} com erro` : "sem erros"} />
        <Stat icon={DollarSign} label="Custo estimado" value={formatUsd(totals.costUsd)} hint="últimas 50" />
        <Stat icon={Database} label="Cache" value={String(totals.cacheHits)} hint="respostas sem custo" />
        <Stat icon={Activity} label="Modelo pro" value={`${Math.round(totals.proShare * 100)}%`} hint="o resto no modelo barato" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/20">
        {runs.length === 0 && !loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma execução ainda. As chamadas do Prime ao AI Gateway aparecem aqui.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                {r.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="font-medium">{AI_TASK_LABEL[r.task_kind as AiTask] ?? r.task_kind}</span>
                {r.tier && <Badge variant="outline" className="text-[10px] uppercase">{r.tier}</Badge>}
                {r.cached && <Badge variant="secondary" className="text-[10px]">cache</Badge>}
                <span className="truncate text-muted-foreground">{r.status === "ok" ? r.model : r.error}</span>
                <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  {r.status === "ok" && <span>{(r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0)} tokens</span>}
                  {r.status === "ok" && <span>{formatUsd(Number(r.cost_usd ?? 0))}</span>}
                  {r.duration_ms != null && <span>{(r.duration_ms / 1000).toFixed(1)}s</span>}
                  <span>{formatTime(r.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Zap; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/20 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground/70">{hint}</p>
    </div>
  );
}
