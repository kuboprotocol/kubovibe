import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Zap } from "lucide-react";

interface SkillExecution {
  id: string;
  skill_slug: string;
  skill_name: string;
  status: string;
  input: any;
  output: any;
  error_message: string | null;
  credits_charged: number;
  duration_ms: number | null;
  created_at: string;
}

export function SkillExecutionsList() {
  const [executions, setExecutions] = useState<SkillExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchExecutions();
    
    // Subscribe to new executions
    const channel = supabase
      .channel("skill_executions_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "skill_executions" },
        (payload) => {
          setExecutions((prev) => [payload.new as SkillExecution, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function fetchExecutions() {
    const { data, error } = await supabase
      .from("skill_executions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching executions:", error);
    } else {
      setExecutions(data || []);
    }
    setLoading(false);
  }

  if (loading) return <div className="text-center py-10 opacity-50">Carregando histórico unificado...</div>;

  return (
    <div className="space-y-4">
      {executions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhuma execução registrada ainda.</p>
      )}
      {executions.map((ex) => (
        <Card key={ex.id} className="overflow-hidden border-primary/10 hover:border-primary/30 transition-colors">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold font-orbitron">{ex.skill_name || ex.skill_slug}</CardTitle>
                <CardDescription className="text-[10px]">{new Date(ex.created_at).toLocaleString()}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5 font-mono">
                {ex.credits_charged}c
              </Badge>
              {ex.status === "succeeded" || ex.status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : ex.status === "failed" ? (
                <XCircle className="w-4 h-4 text-destructive" />
              ) : (
                <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="mt-2 text-[11px] space-y-2">
              {ex.error_message && (
                <p className="text-destructive font-semibold bg-destructive/10 p-2 rounded">{ex.error_message}</p>
              )}
              {ex.input && (
                <div className="bg-muted/30 p-2 rounded">
                  <span className="text-muted-foreground block mb-1 uppercase tracking-wider text-[9px]">Entrada:</span>
                  <pre className="whitespace-pre-wrap line-clamp-2 italic opacity-80">
                    {typeof ex.input === 'object' ? JSON.stringify(ex.input) : ex.input}
                  </pre>
                </div>
              )}
              {ex.output && Object.keys(ex.output).length > 0 && (
                <div className="bg-primary/5 p-2 rounded border border-primary/10">
                  <span className="text-primary/70 block mb-1 uppercase tracking-wider text-[9px]">Resultado:</span>
                  <div className="max-h-32 overflow-auto scrollbar-hide">
                    {ex.output.url ? (
                      <a href={ex.output.url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
                        Ver arquivo gerado →
                      </a>
                    ) : (
                      <pre className="whitespace-pre-wrap opacity-90">
                        {typeof ex.output === 'object' ? JSON.stringify(ex.output, null, 2) : ex.output}
                      </pre>
                    )}
                  </div>
                </div>
              )}
              {ex.duration_ms && (
                <div className="text-right text-[9px] text-muted-foreground opacity-50">
                  Duração: {ex.duration_ms}ms
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
