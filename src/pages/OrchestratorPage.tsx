import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, Sparkles, Activity, ArrowLeft, CheckCircle2, 
  XCircle, Send, History, Settings, Filter, RefreshCcw, 
  ToggleLeft, ToggleRight, Clock, AlertCircle, Info, MoreVertical,
  Pause, Play, Search, BarChart3, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { JobDetailsSheet } from "@/components/dashboard/JobDetailsSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  cached?: boolean;
}

  interface AgentJob {
    id: string;
    agent_slug: string;
    status: string;
    input: any;
    result: any;
    output?: any;
    error_message: string | null;
    execution_time_ms: number | null;
    retry_count: number;
    created_at: string;
    completed_at?: string;
    next_retry_at?: string;
    duration_ms?: number;
    idempotency_key?: string;
    correlation_id?: string;
    paused_at?: string;
  }

  interface JobAuditLog {
    id: string;
    job_id: string;
    action: string;
    details: any;
    created_at: string;
  }


export default function OrchestratorPage() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  
  // Jobs
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Config
  const [disabledAgents, setDisabledAgents] = useState<string[]>([]);
  const [disabledCategories, setDisabledCategories] = useState<string[]>([]);
  const [configLoading, setConfigLoading] = useState(false);

  // Detail View
  const [selectedJob, setSelectedJob] = useState<AgentJob | null>(null);
  const [auditLogs, setAuditLogs] = useState<JobAuditLog[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "polling">("connecting");
  const [websocketError, setWebsocketError] = useState<string | null>(null);
  const [nextPollIn, setNextPollIn] = useState(15);
  const [pollingRetryCount, setPollingRetryCount] = useState(0);
  const [metrics, setMetrics] = useState<{ query_time_ms: number; latency_p95?: number } | null>(null);
  const [latencyThreshold, setLatencyThreshold] = useState(() => {
    const saved = localStorage.getItem('kubo_latency_threshold');
    return saved ? parseInt(saved, 10) : 500;
  }); // ms
  const [maxRetryLimit] = useState(20);



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

  const loadJobs = async () => {
    setJobsLoading(true);
    const start = performance.now();
    try {
      let query = supabase.from("agent_jobs").select("*").order("created_at", { ascending: false }).limit(50);
      
      if (agentFilter !== "all") query = query.eq("agent_slug", agentFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (searchTerm) {
        if (searchTerm.match(/^[0-9a-fA-F-]{36}$/)) {
          query = query.or(`id.eq.${searchTerm},correlation_id.eq.${searchTerm}`);
        } else {
          query = query.or(`id.ilike.%${searchTerm}%,correlation_id.ilike.%${searchTerm}%,idempotency_key.ilike.%${searchTerm}%`);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setJobs((data as any[]) || []);
      
      const end = performance.now();
      const queryTime = Math.round(end - start);
      
      // Simulação de p95 baseada no histórico carregado (ou metadados se existissem)
      const latencies = (data as any[] || []).map(j => j.execution_time_ms || j.duration_ms || 0).filter(l => l > 0);
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p95 = sortedLatencies.length > 0 ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] : undefined;
      
      setMetrics({ query_time_ms: queryTime, latency_p95: p95 });
      
      if (p95 && p95 > latencyThreshold) {
        toast({ 
          title: "Alerta de Performance", 
          description: (
            <div className="flex flex-col gap-2">
              <p>Latência p95 ({p95}ms) acima do limite ({latencyThreshold}ms)</p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] w-fit"
                  onClick={() => {
                    const slowJob = (data as any[]).find(j => (j.execution_time_ms || j.duration_ms || 0) >= p95);
                    if (slowJob) {
                      setSearchTerm(slowJob.correlation_id || slowJob.id);
                      openJobDetails(slowJob);
                    }
                  }}
                >
                  Filtrar e Ver Detalhes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] w-fit"
                  onClick={() => {
                    const slowJob = (data as any[]).find(j => (j.execution_time_ms || j.duration_ms || 0) >= p95);
                    if (slowJob) openJobDetails(slowJob);
                  }}
                >
                  Apenas Abrir
                </Button>
              </div>
            </div>
          ), 
          variant: "destructive",
          duration: 6000
        });
      }

    } catch (e) {
      toast({ title: "Falha ao carregar jobs", description: (e as Error).message, variant: "destructive" });
    } finally {
      setJobsLoading(false);
    }
  };

  const loadConfig = async () => {
    setConfigLoading(true);
    try {
      const { data, error } = await supabase.from("orchestrator_config").select("*");
      if (error) throw error;
      
      const dAgents = (data.find(r => r.key === 'disabled_agents')?.value as string[]) || [];
      const dCats = (data.find(r => r.key === 'disabled_categories')?.value as string[]) || [];

      
      setDisabledAgents(dAgents);
      setDisabledCategories(dCats);
    } catch (e) {
      console.error("Config load error", e);
    } finally {
      setConfigLoading(false);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from("orchestrator_config")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
      if (error) throw error;
      toast({ title: "Configuração atualizada" });
      void loadConfig();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: (e as Error).message, variant: "destructive" });
    }
  };

  const loadAuditLogs = async (jobId: string, correlationId?: string) => {
    try {
      let query = supabase
        .from("job_audit_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (correlationId) {
        query = query.or(`job_id.eq.${jobId},correlation_id.eq.${correlationId}`);
      } else {
        query = query.eq("job_id", jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (e) {
      console.error("Audit log error", e);
    }
  };

  const openJobDetails = (job: AgentJob) => {
    setSelectedJob(job);
    loadAuditLogs(job.id, job.correlation_id);
  };

  const handleJobAction = async (jobId: string, action: "cancel" | "pause" | "resume" | "retry") => {
    setActionLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const correlationId = `web-action-${Date.now()}`;
      
      const { data, error } = await supabase.rpc('execute_job_action', {
        p_job_id: jobId,
        p_action: action,
        p_actor_id: userData.user.id,
        p_correlation_id: correlationId
      });

      if (error) throw error;
      const result = data as any;
      if (result && !result.ok) throw new Error(result.error);

      toast({ title: `Ação ${action} concluída` });
      void loadJobs();
      
      if (selectedJob?.id === jobId) {
        const { data: updatedJob } = await supabase.from("agent_jobs").select("*").eq("id", jobId).maybeSingle();
        if (updatedJob) setSelectedJob(updatedJob as any as AgentJob);
        loadAuditLogs(jobId, correlationId);
      }
    } catch (e) {
      toast({ title: "Erro na ação", description: (e as Error).message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => { 
    void loadHealth(); 
    void loadJobs();
    void loadConfig();

    const setupRealtime = () => {
      setConnectionStatus("connecting");
      setWebsocketError(null);
      const channel = supabase
        .channel('public:agent_jobs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_jobs' }, (payload) => {
          void loadJobs();
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus("live");
            setPollingRetryCount(0);
            setWebsocketError(null);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setConnectionStatus("polling");
            setWebsocketError(err?.message || "Erro desconhecido no WebSocket");
            setPollingRetryCount(prev => {
              const nextCount = Math.min(prev + 1, maxRetryLimit);
              const backoff = Math.min(60, Math.pow(2, nextCount) + Math.random() * 5);
              setNextPollIn(Math.round(backoff));
              return nextCount;
            });
          }
        });
      return channel;
    };


    let channel = setupRealtime();

    const interval = setInterval(() => {
      setNextPollIn(prev => {
        if (prev <= 1) {
          loadJobs();
          if (connectionStatus === "polling") {
            const nextCount = Math.min(pollingRetryCount + 1, maxRetryLimit);
            setPollingRetryCount(nextCount);
            const backoff = Math.min(60, Math.pow(2, nextCount) + Math.random() * 5);
            return Math.round(backoff);
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);


    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [agentFilter, statusFilter, searchTerm, connectionStatus]);

  // Efeito separado para o Job selecionado (Timeline Realtime)
  useEffect(() => {
    if (!selectedJob) return;

    const channel = supabase
      .channel(`job_details:${selectedJob.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agent_jobs',
        filter: `id=eq.${selectedJob.id}`
      }, (payload) => {
        setSelectedJob(payload.new as any as AgentJob);
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'job_audit_logs',
        filter: `job_id=eq.${selectedJob.id}`
      }, (payload) => {
        setAuditLogs(prev => [payload.new as any as JobAuditLog, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedJob?.id]);

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
        headers: { "x-idempotency-key": `web-${Date.now()}` }
      });
      if (error) throw error;
      if (data) {
        if (mode === "classify" && (data as any).agent) {
          const r = data as any as Routing;
          setResult({ ok: true, routing: r, result: { classified_only: true } });
        } else {
          setResult(data);
        }
      }
      void loadJobs();
    } catch (e) {
      toast({ title: "Erro no orquestrador", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const toggleAgent = (slug: string) => {
    const newList = disabledAgents.includes(slug) 
      ? disabledAgents.filter(s => s !== slug) 
      : [...disabledAgents, slug];
    setDisabledAgents(newList);
    updateConfig('disabled_agents', newList);
  };

  const toggleCategory = (cat: string) => {
    const newList = disabledCategories.includes(cat) 
      ? disabledCategories.filter(c => c !== cat) 
      : [...disabledCategories, cat];
    setDisabledCategories(newList);
    updateConfig('disabled_categories', newList);
  };

  const groupedByCategory = (health?.agents ?? []).reduce<Record<string, HealthAgent[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const categories = Array.from(new Set((health?.agents ?? []).map(a => a.category)));

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Orquestrador KUBO</h1>
            <p className="text-muted-foreground">Orquestração full-stack com filas, retries e roteamento dinâmico.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <div 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  connectionStatus === 'polling' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                  connectionStatus === 'live' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-muted/50'
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 
                  connectionStatus === 'connecting' ? 'bg-amber-500' : 'bg-amber-600'
                }`} />
                {connectionStatus === 'live' ? 'LIVE' : connectionStatus === 'connecting' ? 'CONECTANDO...' : `POLLING (${nextPollIn}s)`}
              </div>
              <Button variant="outline" size="sm" onClick={() => { loadHealth(); loadJobs(); loadConfig(); }}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
              </Button>
              <Badge variant="secondary" className="h-8">V2.1</Badge>
            </div>
            {metrics && (
              <div className={`flex items-center gap-2 text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
                metrics.latency_p95 && metrics.latency_p95 > latencyThreshold 
                  ? 'bg-destructive/10 text-destructive border-destructive/30 animate-pulse' 
                  : 'text-muted-foreground bg-muted/30 border-border/50'
              }`}>
                <BarChart3 className="h-3 w-3" />
                Query: {metrics.query_time_ms}ms | Trace Match: INDEXED
                {metrics.latency_p95 && (
                  <span className={`ml-2 px-1 rounded flex items-center gap-1 ${metrics.latency_p95 > latencyThreshold ? 'bg-destructive text-white font-bold' : 'text-emerald-500'}`}>
                    {metrics.latency_p95 > latencyThreshold && <AlertTriangle className="h-2.5 w-2.5" />}
                    p95: {metrics.latency_p95}ms
                  </span>
                )}
              </div>


            )}
          </div>
        </div>

        <Tabs defaultValue="composer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
            <TabsTrigger value="composer"><Sparkles className="mr-2 h-4 w-4" /> Composer</TabsTrigger>
            <TabsTrigger value="jobs"><History className="mr-2 h-4 w-4" /> Jobs</TabsTrigger>
            <TabsTrigger value="health"><Activity className="mr-2 h-4 w-4" /> Saúde</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" /> Config</TabsTrigger>
            <TabsTrigger value="perf"><BarChart3 className="mr-2 h-4 w-4" /> Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="perf" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Configurações de Monitoramento</CardTitle>
                <CardDescription>Ajuste os limites de latência para alertas em tempo real.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-medium text-foreground">Limite p95 (ms)</h4>
                      <p className="text-xs text-muted-foreground">Dispara um alerta quando a latência p95 dos últimos 50 jobs ultrapassar este valor.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        value={latencyThreshold} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setLatencyThreshold(val);
                          localStorage.setItem('kubo_latency_threshold', val.toString());
                        }}
                        className="w-24 font-mono text-center"
                      />
                      <span className="text-xs text-muted-foreground font-mono">ms</span>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                    <h4 className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider">
                      <AlertTriangle className="h-3 w-3 text-amber-500" /> Métricas Atuais
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-background p-3 rounded border">
                        <p className="text-[10px] text-muted-foreground uppercase">Latência p95</p>
                        <p className={`text-2xl font-bold font-mono ${metrics?.latency_p95 && metrics.latency_p95 > latencyThreshold ? 'text-destructive' : 'text-emerald-500'}`}>
                          {metrics?.latency_p95 ? `${metrics.latency_p95}ms` : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-background p-3 rounded border">
                        <p className="text-[10px] text-muted-foreground uppercase">Tempo de Query</p>
                        <p className="text-2xl font-bold font-mono text-primary">
                          {metrics?.query_time_ms ? `${metrics.query_time_ms}ms` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="composer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> O que você quer fazer?</CardTitle>
                <CardDescription>O orquestrador escolherá o melhor agente para o seu pedido.</CardDescription>
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
                    Simular Roteamento
                  </Button>
                  <Button onClick={() => run("execute")} disabled={running}>
                    {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Executar Fluxo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {result && (
              <Card className="animate-in fade-in slide-in-from-top-4">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                      {result.cached ? "Resultado (Cache/Idempotente)" : "Resultado da Execução"}
                    </div>
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline">Agente: {result.routing.agent}</Badge>
                    <Badge variant="secondary">Roteado via: {result.routing.source}</Badge>
                    <Badge variant="secondary">Confiança: {Math.round(result.routing.confidence * 100)}%</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs font-mono">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Histórico de Execuções</CardTitle>
                  <CardDescription>Monitoramento em tempo real dos jobs processados.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative w-full lg:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="TraceID / ID..."
                      className="pl-8 w-full lg:w-[200px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Agente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Agentes</SelectItem>
                      {health?.agents.map(a => (
                        <SelectItem key={a.slug} value={a.slug}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="failed">Falhou</SelectItem>
                      <SelectItem value="processing">Processando</SelectItem>
                      <SelectItem value="paused">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={loadJobs} disabled={jobsLoading}>
                    <RefreshCcw className={`h-4 w-4 ${jobsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Agente</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openJobDetails(job)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {job.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            {job.status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
                            {job.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            {job.status === "paused" && <Pause className="h-4 w-4 text-amber-500" />}
                            <span className="capitalize text-xs font-medium">{job.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{job.agent_slug}</TableCell>
                        <TableCell className="text-xs">{job.execution_time_ms || job.duration_ms ? `${job.execution_time_ms || job.duration_ms}ms` : '-'}</TableCell>
                        <TableCell className="text-xs">{job.retry_count || 0}</TableCell>
                        <TableCell className="text-xs">{new Date(job.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openJobDetails(job)}>
                                <Info className="mr-2 h-4 w-4" /> Ver Detalhes
                              </DropdownMenuItem>
                              {job.status === "failed" && (
                                <DropdownMenuItem onClick={() => handleJobAction(job.id, "retry")}>
                                  <RefreshCcw className="mr-2 h-4 w-4" /> Reexecutar
                                </DropdownMenuItem>
                              )}
                              {job.status === "processing" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleJobAction(job.id, "pause")}>
                                    <Pause className="mr-2 h-4 w-4" /> Pausar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleJobAction(job.id, "cancel")}>
                                    <XCircle className="mr-2 h-4 w-4" /> Cancelar
                                  </DropdownMenuItem>
                                </>
                              )}
                              {job.status === "paused" && (
                                <DropdownMenuItem onClick={() => handleJobAction(job.id, "resume")}>
                                  <Play className="mr-2 h-4 w-4" /> Retomar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {jobs.length === 0 && !jobsLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum job encontrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health">
            {health && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Diagnóstico do Sistema</CardTitle>
                  <CardDescription>
                    {health.summary.healthy}/{health.summary.total} saudáveis · latência média {health.summary.avg_latency_ms}ms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(groupedByCategory).map(([cat, items]) => (
                    <div key={cat} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">{cat}</h3>
                        {disabledCategories.includes(cat) && <Badge variant="destructive">Desativada</Badge>}
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {items.map((a) => (
                          <div 
                            key={a.slug} 
                            className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors ${disabledAgents.includes(a.slug) ? 'bg-muted/50 opacity-60' : 'bg-card'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 overflow-hidden">
                                {a.health === "healthy" ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                                )}
                                <span className="truncate font-semibold">{a.name}</span>
                              </div>
                              <Badge variant={a.health === "healthy" ? "secondary" : "destructive"}>{a.latency_ms}ms</Badge>
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground truncate">{a.edge_function}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Performance & Latência</CardTitle>
                  <CardDescription>Configure limites para alertas automáticos de regressão.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Limite p95 (ms)</label>
                    <div className="flex items-center gap-4">
                      <Input 
                        type="number" 
                        value={latencyThreshold} 
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setLatencyThreshold(val);
                          localStorage.setItem('kubo_latency_threshold', val.toString());
                        }}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground">Jobs acima deste valor dispararão alertas na UI.</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setLatencyThreshold(500);
                      localStorage.setItem('kubo_latency_threshold', '500');
                      toast({ title: "Limites restaurados", description: "O limite p95 voltou ao padrão de 500ms." });
                    }}
                  >
                    Restaurar Padrões
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Controle por Categoria</CardTitle>
                  <CardDescription>Habilite ou desabilite grupos inteiros de agentes instantaneamente.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">{cat}</div>
                        <div className="text-xs text-muted-foreground">Status: {!disabledCategories.includes(cat) ? 'Ativo' : 'Pausado'}</div>
                      </div>
                      <Switch 
                        checked={!disabledCategories.includes(cat)} 
                        onCheckedChange={() => toggleCategory(cat)} 
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Controle por Agente</CardTitle>
                  <CardDescription>Ajuste fino do roteamento individualmente.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[500px] overflow-auto space-y-3">
                  {health?.agents.map(a => (
                    <div key={a.slug} className="flex items-center justify-between p-2 border-b last:border-0 pb-3">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">{a.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{a.slug}</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant={disabledAgents.includes(a.slug) ? "outline" : "secondary"}
                        onClick={() => toggleAgent(a.slug)}
                      >
                        {disabledAgents.includes(a.slug) ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                        {disabledAgents.includes(a.slug) ? 'Ativar' : 'Pausar'}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <JobDetailsSheet 
        job={selectedJob} 
        auditLogs={auditLogs}
        onClose={() => setSelectedJob(null)}
        onAction={(action) => handleJobAction(selectedJob?.id || "", action)}
        loading={actionLoading}
        connectionStatus={connectionStatus}
        nextPollIn={nextPollIn}
        pollingRetryCount={pollingRetryCount}
        onReconnect={() => {
          setPollingRetryCount(0);
          setConnectionStatus("connecting");

          loadJobs();
        }}
      />
    </div>
  );
}
