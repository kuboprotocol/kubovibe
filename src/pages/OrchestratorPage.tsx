import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Activity, ArrowLeft, CheckCircle2, XCircle, Send } from "lucide-react";

interface HealthAgent {
  slug: string;
  name: string;
  category: string;
  edge_function: string;
  credit_cost: number;
  registry_status: string;
  health: "healthy" | "unhealthy";
  http_status: number;
  latency_ms: number;
  error: string | null;
}

interface HealthResponse {
  ok: boolean;
  checked_at: string;
  summary: { total: number; healthy: number; unhealthy: number; avg_latency_ms: number };
  agents: HealthAgent[];
}

interface Routing {
  agent: string;
  confidence: number;
  source: "rule" | "ai" | "fallback";
  reason: string;
}

interface RunResult {
  ok: boolean;
  routing: Routing;
  result: unknown;
}

export default function OrchestratorPage() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<HealthResponse>("orchestrator-health");
      if (error) throw error;
      setHealth(data ?? null);
    } catch (e) {
      toast({ title: "Falha ao carregar health", description: (e as Error).message, variant: "destructive" });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => { void loadHealth(); }, []);

  const run = async (mode: "classify" | "execute") => {
    if (!prompt.trim()) {
      toast({ title: "Digite o que deseja", variant: "destructive" });
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<RunResult>("orchestrator-route", {
        body: { mode, prompt: prompt.trim() },
      });
      if (error) throw error;
      if (data) {
        // modo classify devolve {ok, agent, ...}; normaliza
        if (mode === "classify" && (data as unknown as Routing).agent) {
          const r = data as unknown as Routing;
          setResult({ ok: true, routing: r, result: { classified_only: true } });
          toast({ title: "Roteado", description: `Agente: ${r.agent} (${r.source}, ${Math.round(r.confidence * 100)}%)` });
        } else {
          setResult(data);
          toast({ title: data.ok ? "Executado" : "Falhou", description: `via ${data.routing?.agent}` });
        }
      }
    } catch (e) {
      toast({ title: "Erro no orquestrador", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const groupedByCategory = (health?.agents ?? []).reduce<Record<string, HealthAgent[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Orquestrador KUBO</h1>
            <p className="text-muted-foreground">Um único ponto para todos os agentes — roteamento híbrido (regras + IA).</p>
          </div>
          <Button variant="outline" onClick={loadHealth} disabled={healthLoading}>
            {healthLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
            Health
          </Button>
        </div>

        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> O que você quer fazer?</CardTitle>
            <CardDescription>Descreva em PT-BR. Ex: "criar um PDF do meu relatório", "baixar vídeo do YouTube X", "fazer slides do pitch".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Escreva seu pedido..."
              rows={4}
              disabled={running}
            />
            <div className="flex gap-2">
              <Button onClick={() => run("classify")} disabled={running} variant="secondary">
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Somente rotear
              </Button>
              <Button onClick={() => run("execute")} disabled={running}>
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Executar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                Resultado
              </CardTitle>
              <CardDescription>
                Agente: <Badge variant="outline">{result.routing.agent}</Badge>{" "}
                Origem: <Badge variant="secondary">{result.routing.source}</Badge>{" "}
                Confiança: {Math.round(result.routing.confidence * 100)}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Health dashboard */}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Saúde dos Agentes</CardTitle>
              <CardDescription>
                {health.summary.healthy}/{health.summary.total} saudáveis · latência média {health.summary.avg_latency_ms}ms · verificado{" "}
                {new Date(health.checked_at).toLocaleTimeString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(groupedByCategory).map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">{cat}</h3>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((a) => (
                      <div key={a.slug} className="flex items-center justify-between rounded-md border p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {a.health === "healthy" ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                            )}
                            <span className="truncate font-medium">{a.name}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {a.slug} · {a.latency_ms}ms · {a.credit_cost} créditos
                          </div>
                        </div>
                        <Badge variant={a.health === "healthy" ? "outline" : "destructive"}>{a.http_status || "?"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
