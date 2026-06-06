import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Zap, ArrowLeft } from "lucide-react";

interface Agent {
  slug: string;
  name: string;
  description: string;
  category: string;
  credit_cost: number;
  edge_function: string;
  status: string;
}

interface JobRow {
  id: string;
  agent_slug: string;
  status: string;
  credits_charged: number;
  duration_ms: number | null;
  output: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
}

export default function AgentsHubPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("agent_registry")
        .select("*")
        .order("status", { ascending: true })
        .order("name", { ascending: true });
      setAgents((data ?? []) as Agent[]);
    })();
    void refreshJobs();
  }, []);

  async function refreshJobs() {
    const { data } = await supabase
      .from("agent_jobs")
      .select("id, agent_slug, status, credits_charged, duration_ms, output, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setJobs((data ?? []) as JobRow[]);
  }

  async function runAgent() {
    if (!selected || !prompt.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("agent-route", {
        body: { agent: selected.slug, input: { prompt } },
      });
      if (error) throw error;
      setResult(data);
      toast({ title: `${selected.name} executado`, description: `${selected.credit_cost} créditos consumidos.` });
      void refreshJobs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falhou", description: msg, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  const categories = Array.from(new Set(agents.map(a => a.category)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "Orbitron, sans-serif" }}>
              KUBO Agents
            </h1>
            <p className="text-muted-foreground mt-1">
              Microsserviços criativos do KUBO — cada agente é uma edge function com débito atômico de créditos.
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {agents.filter(a => a.status === "active").length} ativos
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-8">
            {categories.map((cat) => (
              <section key={cat}>
                <h2 className="text-lg font-semibold mb-3 capitalize text-muted-foreground">{cat}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {agents.filter(a => a.category === cat).map(a => (
                    <Card
                      key={a.slug}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${selected?.slug === a.slug ? "border-primary" : ""}`}
                      onClick={() => setSelected(a)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            {a.name}
                          </CardTitle>
                          <Badge variant={a.status === "active" ? "default" : "outline"} className="text-xs">
                            {a.status}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">{a.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Zap className="w-3 h-3" />
                          {a.credit_cost} créditos
                          <span className="ml-auto font-mono opacity-60">{a.edge_function}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selected ? `Executar: ${selected.name}` : "Selecione um agente"}
                </CardTitle>
                {selected && (
                  <CardDescription className="text-xs">{selected.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Escreva o prompt/instrução…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  disabled={!selected || running}
                />
                <Button
                  className="w-full"
                  onClick={runAgent}
                  disabled={!selected || running || !prompt.trim()}
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {running ? "Executando…" : selected ? `Rodar (${selected.credit_cost} créditos)` : "Selecione"}
                </Button>
                {result != null && (
                  <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-80">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas execuções</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-auto">
                {jobs.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum job ainda.</p>
                )}
                {jobs.map((j) => (
                  <div key={j.id} className="text-xs border-l-2 border-border pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{j.agent_slug}</span>
                      <Badge
                        variant={j.status === "succeeded" ? "default" : j.status === "failed" || j.status === "refunded" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {j.status}
                      </Badge>
                      <span className="text-muted-foreground ml-auto">
                        {j.credits_charged}c · {j.duration_ms ?? "–"}ms
                      </span>
                    </div>
                    {j.error_message && (
                      <p className="text-destructive mt-1">{j.error_message}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
