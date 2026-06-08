import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, RotateCw, Ban, ExternalLink, Clock, Package } from "lucide-react";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const [exportRow, setExportRow] = useState<Export | null>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user || !id) return;
    const { data: exp } = await supabase
      .from("creative_export_history")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!exp) { setLoading(false); return; }
    setExportRow(exp as Export);

    if (exp.item_ids && exp.item_ids.length > 0) {
      const { data: items } = await supabase
        .from("creative_assets")
        .select("id, tool, status, prompt, created_at")
        .in("id", exp.item_ids);
      setExecutions(items || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, id]);

  // Realtime polling for status changes
  useEffect(() => {
    if (!user || !id) return;
    const ch = supabase
      .channel(`export-${id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "creative_export_history", filter: `id=eq.${id}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, id]); // eslint-disable-line

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

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!exportRow) return <div className="p-8 text-center text-muted-foreground">Exportação não encontrada</div>;

  const totalSeconds = Math.round((exportRow.generation_time_ms ?? 0) / 1000);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/creative")}>
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
            {(exportRow.status === "failed" || exportRow.status === "cancelled") && (
              <Button data-testid="requeue-export" onClick={requeue}><RotateCw className="h-4 w-4 mr-2"/>Reenfileirar</Button>
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
                  <TableCell><Badge>{e.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/creative/investigation?investigate=${e.id}`)}>
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
