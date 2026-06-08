import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, RotateCw, Ban, ExternalLink, Clock, Package, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


type Export = {
  id: string;
  status: string;
  format: string;
  file_url: string | null;
  item_count: number;
  included_count: number;
  generation_time_ms: number;
  item_ids: string[] | null;
  date_range_start: string | null;
  date_range_end: string | null;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  generation_started_at: string | null;
  updated_at: string;
};

export default function ExportDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const investigateId = searchParams.get("investigate");
  const { user } = useAuth();
  const [exportRow, setExportRow] = useState<Export | null>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!user || !id) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data: exp, error: expErr } = await supabase
        .from("creative_export_history")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (expErr) throw expErr;
      if (!exp) {
        setError("Exportação não encontrada");
        setLoading(false);
        return;
      }
      setExportRow(exp as Export);

      if (exp.item_ids && exp.item_ids.length > 0) {
        const { data: items, error: itemsErr } = await supabase
          .from("creative_assets")
          .select("id, tool, status, prompt, created_at, metadata")
          .in("id", exp.item_ids);
        if (itemsErr) throw itemsErr;
        setExecutions(items || []);
      }
    } catch (err: any) {
      if (!silent) setError(err.message);
      toast.error("Erro ao carregar detalhes: " + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, id]);

  useEffect(() => { load(); }, [load]);


  // Realtime polling for status changes
  useEffect(() => {
    if (!user || !id) return;
    const ch = supabase
      .channel(`export-${id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "creative_export_history", filter: `id=eq.${id}`,
      }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, id, load]);


  async function cancel() {
    if (!exportRow || !user) return;
    if (!confirm("Cancelar esta exportação?")) return;
    const { error } = await supabase
      .from("creative_export_history")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq("id", exportRow.id);
    if (error) return toast.error(error.message);
    await supabase.from("creative_export_audit_log").insert({
      export_id: exportRow.id, user_id: user.id, action: "cancel",
      details: { actor_email: user.email, at: new Date().toISOString() },
    });
    toast.success("Exportação cancelada");
    load();
  }

  async function requeue() {
    if (!exportRow || !user) return;
    const { error } = await supabase
      .from("creative_export_history")
      .update({
        status: "processing",
        retry_count: (exportRow.retry_count ?? 0) + 1,
        last_retry_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", exportRow.id);
    if (error) return toast.error(error.message);
    await supabase.from("creative_export_audit_log").insert({
      export_id: exportRow.id, user_id: user.id, action: "retry",
      details: { actor_email: user.email, at: new Date().toISOString(), previous_status: exportRow.status },
    });
    toast.success("Reenfileirado");
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => {
            const params = new URLSearchParams(searchParams);
            navigate({ pathname: "/creative", search: params.toString() });
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-6 w-48" />
        </header>
        <div className="p-4 max-w-5xl mx-auto space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </Card>
          <Card className="p-4 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !exportRow) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => {
            const params = new URLSearchParams(searchParams);
            navigate({ pathname: "/creative", search: params.toString() });
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold flex-1">Erro</h1>
        </header>
        <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">{error || "Exportação não encontrada"}</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/creative")}>Voltar para Creative</Button>
            <Button onClick={() => load()}>Tentar novamente</Button>
          </div>
        </div>
      </div>
    );
  }


  const totalSeconds = Math.round((exportRow.generation_time_ms ?? 0) / 1000);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => {
          const params = new URLSearchParams(searchParams);
          navigate({ pathname: "/creative", search: params.toString() });
        }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">Detalhes da Exportação</h1>
      </header>

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-muted-foreground">ID</div>
              <div className="font-mono text-sm">{exportRow.id}</div>
            </div>
            <Badge className="capitalize">{exportRow.status}</Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={Package} label="Execuções incluídas" value={`${exportRow.included_count ?? exportRow.item_ids?.length ?? 0}`} />
            <Stat icon={Clock} label="Tempo total" value={totalSeconds > 0 ? `${totalSeconds}s` : "—"} />
            <Stat icon={Download} label="Formato" value={exportRow.format.toUpperCase()} />
            <Stat icon={RotateCw} label="Tentativas" value={String(exportRow.retry_count ?? 0)} />
          </div>

          {exportRow.error_message && (
            <div className="mt-4 p-3 rounded bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <strong>Erro:</strong> {exportRow.error_message}
            </div>
          )}

          <div className="mt-4 flex gap-2 flex-wrap">
            {exportRow.file_url && (
              <a href={exportRow.file_url} target="_blank" rel="noreferrer">
                <Button data-testid="download-file"><Download className="h-4 w-4 mr-2"/>Baixar arquivo</Button>
              </a>
            )}
            {exportRow.status === "processing" && (
              <Button data-testid="cancel-export" variant="destructive" onClick={cancel}><Ban className="h-4 w-4 mr-2"/>Cancelar</Button>
            )}
            {(exportRow.status === "failed" || exportRow.status === "cancelled" || error) && (
              <Button data-testid="requeue-export" onClick={() => error ? load() : requeue()} variant={error ? "default" : "secondary"}>
                <RotateCw className="h-4 w-4 mr-2"/>
                {error ? "Tentar novamente" : "Reenfileirar"}
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-3 border-b border-border font-semibold">Execuções incluídas ({executions.length})</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ferramenta</TableHead>
                <TableHead>Execução</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma execução listada</TableCell></TableRow>
              )}
              {executions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="outline">{e.tool}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{e.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={`capitalize ${e.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : e.status === 'failed' ? 'bg-destructive/10 text-destructive' : ''}`}>
                        {e.status}
                      </Badge>
                      {(e.metadata?.error || e.metadata?.reason) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs">{e.metadata.error || e.metadata.reason}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      const params = new URLSearchParams(searchParams);
                      params.set("investigate", e.id);
                      navigate(`/creative/investigation?${params.toString()}`);
                    }}>
                      <ExternalLink className="h-3 w-3 mr-1"/>Investigar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="p-3 rounded border border-border bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3 w-3"/>{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
