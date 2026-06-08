import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, Users, Bot, FileText, ArrowLeft, ScrollText } from "lucide-react";



interface AgentRow { slug: string; name: string; category: string; status: string; credit_cost: number; edge_function: string }
interface JobRow { id: string; user_id: string; agent_slug: string; status: string; credits_charged: number; duration_ms: number | null; created_at: string; error_message: string | null }
interface AuditRow { id: string; actor_user_id: string | null; actor_role: string; action: string; resource_type: string; resource_id: string | null; success: boolean; error_message: string | null; created_at: string }

export default function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);

  

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      setBusy(true);
      const [a, j, l] = await Promise.all([
        supabase.from("agent_registry").select("*").order("category").order("name"),
        supabase.from("agent_jobs").select("id, user_id, agent_slug, status, credits_charged, duration_ms, created_at, error_message").order("created_at", { ascending: false }).limit(200),
        supabase.from("security_audit_logs").select("id, actor_user_id, actor_role, action, resource_type, resource_id, success, error_message, created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      setAgents((a.data ?? []) as AgentRow[]);
      setJobs((j.data ?? []) as JobRow[]);
      setAudits((l.data ?? []) as AuditRow[]);
      setBusy(false);
    })();
  }, [isAdmin]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const filteredJobs = jobs.filter(j =>
    !search || j.agent_slug.includes(search) || j.user_id.includes(search) || j.status.includes(search)
  );
  const filteredAudits = audits.filter(a =>
    !search || a.action.includes(search) || (a.resource_id ?? "").includes(search) || (a.actor_user_id ?? "").includes(search)
  );

  const totalJobs = jobs.length;
  const succeeded = jobs.filter(j => j.status === "succeeded").length;
  const failed = jobs.filter(j => j.status === "failed" || j.status === "refunded").length;
  const totalCredits = jobs.reduce((s, j) => s + (j.credits_charged ?? 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "Orbitron, sans-serif" }}>
              <Shield className="inline w-7 h-7 mr-2 text-primary" /> KUBO Admin
            </h1>
            <p className="text-muted-foreground mt-1">Operações, monitoramento e auditoria global.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/skills"><Badge variant="outline" className="cursor-pointer">Skills</Badge></Link>
            <Link to="/agents"><Badge variant="outline" className="cursor-pointer">Agents Hub</Badge></Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Agentes" value={agents.length} sub={`${agents.filter(a => a.status === "active").length} ativos`} icon={<Bot />} />
          <StatCard label="Jobs (200 últimos)" value={totalJobs} sub={`${succeeded} ok · ${failed} falhas`} icon={<FileText />} />
          <StatCard label="Créditos gastos" value={totalCredits} sub="amostra recente" icon={<Users />} />
          <StatCard label="Audit logs" value={audits.length} sub="200 últimos" icon={<ScrollText />} />
        </div>

        <div className="mb-4">
          <Input placeholder="Filtrar por slug, user_id, action…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
        </div>

        <Tabs defaultValue="jobs">
          <TabsList>
            <TabsTrigger value="jobs">Jobs ({filteredJobs.length})</TabsTrigger>
            <TabsTrigger value="agents">Agentes ({agents.length})</TabsTrigger>
            <TabsTrigger value="audits">Auditoria ({filteredAudits.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <Card>
              <CardContent className="p-0 max-h-[600px] overflow-auto">
                {busy && <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…</div>}
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr><th className="text-left p-2">Quando</th><th className="text-left p-2">Agente</th><th className="text-left p-2">User</th><th className="text-left p-2">Status</th><th className="text-right p-2">Créditos</th><th className="text-right p-2">Duração</th></tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(j => (
                      <tr key={j.id} className="border-t border-border">
                        <td className="p-2 whitespace-nowrap">{new Date(j.created_at).toLocaleString()}</td>
                        <td className="p-2 font-mono">{j.agent_slug}</td>
                        <td className="p-2 font-mono opacity-70">{j.user_id.slice(0, 8)}…</td>
                        <td className="p-2"><Badge variant={j.status === "succeeded" ? "default" : j.status === "queued" || j.status === "running" ? "outline" : "destructive"} className="text-[10px]">{j.status}</Badge></td>
                        <td className="p-2 text-right">{j.credits_charged}</td>
                        <td className="p-2 text-right">{j.duration_ms ?? "–"}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map(a => (
                <Link key={a.slug} to={`/agents/${a.slug}`}>
                  <Card className="hover:border-primary/50 transition-colors h-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{a.name}</CardTitle>
                        <Badge variant={a.status === "active" ? "default" : "outline"} className="text-[10px]">{a.status}</Badge>
                      </div>
                      <CardDescription className="text-xs font-mono">{a.edge_function}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground pt-0 flex justify-between">
                      <span>{a.category}</span>
                      <span>{a.credit_cost}c</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="audits">
            <Card>
              <CardContent className="p-0 max-h-[600px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr><th className="text-left p-2">Quando</th><th className="text-left p-2">Action</th><th className="text-left p-2">Recurso</th><th className="text-left p-2">Actor</th><th className="text-left p-2">OK</th><th className="text-left p-2">Erro</th></tr>
                  </thead>
                  <tbody>
                    {filteredAudits.map(a => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="p-2 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                        <td className="p-2 font-mono">{a.action}</td>
                        <td className="p-2"><span className="opacity-70">{a.resource_type}</span> {a.resource_id && <span className="font-mono">/ {a.resource_id}</span>}</td>
                        <td className="p-2 font-mono opacity-70">{a.actor_role}{a.actor_user_id ? ` · ${a.actor_user_id.slice(0, 8)}…` : ""}</td>
                        <td className="p-2">{a.success ? "✓" : "✗"}</td>
                        <td className="p-2 text-destructive truncate max-w-xs">{a.error_message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: number | string; sub: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-muted-foreground opacity-60 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
