import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Zap, ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Agent {
  slug: string; name: string; description: string; category: string;
  credit_cost: number; edge_function: string; status: string;
}
interface JobRow {
  id: string; status: string; credits_charged: number; duration_ms: number | null;
  output: Record<string, unknown> | null; input: Record<string, unknown> | null;
  error_message: string | null; created_at: string;
}

const EXTRA_FIELDS: Record<string, Array<{ key: string; label: string; type?: "number" | "text"; default?: string | number }>> = {
  slides: [{ key: "slideCount", label: "Slides", type: "number", default: 8 }],
  "short-video": [{ key: "duration", label: "Duração (s)", type: "number", default: 30 }],
  opusclip: [{ key: "videoTitle", label: "Título do vídeo" }, { key: "count", label: "Nº de clipes", type: "number", default: 5 }],
  "avatar-speaker": [{ key: "persona", label: "Persona", default: "host profissional" }, { key: "duration", label: "Duração (s)", type: "number", default: 60 }],
  "doc-converter": [{ key: "from", label: "De", default: "markdown" }, { key: "to", label: "Para", default: "html" }],
  "video-downloader": [{ key: "url", label: "URL do vídeo" }],
  "nano-banana": [{ key: "format", label: "Formato", default: "post" }, { key: "count", label: "Variações", type: "number", default: 5 }],
};

const PROMPT_KEY: Record<string, string> = {
  "doc-converter": "content",
  "video-downloader": "url",
  manus: "task",
  "opusclip": "transcript",
};

export default function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [extras, setExtras] = useState<Record<string, string | number>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      const { data } = await supabase.from("agent_registry").select("*").eq("slug", slug).maybeSingle();
      setAgent((data as Agent) ?? null);
      setLoading(false);
      const fields = EXTRA_FIELDS[slug] ?? [];
      const init: Record<string, string | number> = {};
      fields.forEach(f => { if (f.default !== undefined) init[f.key] = f.default; });
      setExtras(init);
      void refreshJobs();
    })();
  }, [slug]);

  async function refreshJobs() {
    if (!slug) return;
    const { data } = await supabase
      .from("agent_jobs")
      .select("id, status, credits_charged, duration_ms, output, input, error_message, created_at")
      .eq("agent_slug", slug)
      .order("created_at", { ascending: false })
      .limit(20);
    setJobs((data ?? []) as JobRow[]);
  }

  async function run() {
    if (!agent || !prompt.trim()) return;
    setRunning(true); setResult(null);
    try {
      const promptField = PROMPT_KEY[agent.slug] ?? "prompt";
      const body = { agent: agent.slug, input: { [promptField]: prompt, ...extras } };
      const { data, error } = await supabase.functions.invoke("agent-route", { body });
      if (error) throw error;
      setResult(data);
      toast({ title: `${agent.name} ok`, description: `${agent.credit_cost} créditos.` });
      void refreshJobs();
    } catch (e) {
      toast({ title: "Falhou", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setRunning(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!agent) return <Navigate to="/agents" replace />;

  const fields = EXTRA_FIELDS[agent.slug] ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link to="/agents" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Todos os agentes
        </Link>

        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Orbitron, sans-serif" }}>{agent.name}</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">{agent.description}</p>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant={agent.status === "active" ? "default" : "outline"}>{agent.status}</Badge>
              <Badge variant="secondary"><Zap className="w-3 h-3 mr-1" />{agent.credit_cost} créditos</Badge>
              <Badge variant="outline" className="font-mono text-xs">{agent.edge_function}</Badge>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Executar</CardTitle>
              <CardDescription>Entrada principal + parâmetros opcionais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={8} placeholder="Prompt / conteúdo / tarefa…" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={running} />
              {fields.map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    value={String(extras[f.key] ?? "")}
                    onChange={e => setExtras(s => ({ ...s, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                    disabled={running}
                  />
                </div>
              ))}
              <Button className="w-full" onClick={run} disabled={running || !prompt.trim()}>
                {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                {running ? "Executando…" : `Rodar (${agent.credit_cost}c)`}
              </Button>
              {result != null && (
                <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico ({jobs.length})</CardTitle>
              <CardDescription>Últimos 20 jobs deste agente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-auto">
              {jobs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum job ainda.</p>}
              {jobs.map(j => (
                <div key={j.id} className="text-xs border rounded p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    {j.status === "succeeded" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                      j.status === "failed" || j.status === "refunded" ? <XCircle className="w-3 h-3 text-destructive" /> :
                      <Clock className="w-3 h-3 text-muted-foreground" />}
                    <span className="font-mono">{j.status}</span>
                    <span className="text-muted-foreground ml-auto">{j.credits_charged}c · {j.duration_ms ?? "–"}ms</span>
                  </div>
                  <div className="text-muted-foreground opacity-70">{new Date(j.created_at).toLocaleString()}</div>
                  {j.error_message && <p className="text-destructive">{j.error_message}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
