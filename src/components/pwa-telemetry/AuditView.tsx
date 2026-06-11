import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, History, Trash2, Download } from "lucide-react";

interface AuditViewProps {
  logs: any[];
}

export const AuditView = ({ logs }: AuditViewProps) => {
  const [selectedLog, setSelectedLog] = useState<any>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <div>
            <CardTitle>Audit Trail de Telemetria</CardTitle>
            <CardDescription>Registro de ações administrativas (limpeza e exportação).</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Resumo dos Filtros</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Nenhum registro de auditoria encontrado.
                </TableCell>
              </TableRow>
            ) : logs.map((log) => {
              const filters = log.filters || {};
              const summaryElements = Object.entries(filters)
                .filter(([_, v]) => v !== null && v !== "" && v !== "all")
                .map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-[10px] px-1 py-0 mr-1">
                    {k}: {typeof v === 'string' && v.length > 20 ? v.slice(0, 8) + '…' : String(v)}
                  </Badge>
                ));

              return (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{log.actor?.email?.split('@')[0]}</span>
                      <span className="text-[10px] text-muted-foreground">{log.actor?.email || log.actor_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {log.action_type === 'clear' ? (
                        <Trash2 className="w-3 h-3 text-destructive" />
                      ) : (
                        <Download className="w-3 h-3 text-blue-500" />
                      )}
                      <Badge variant={log.action_type === 'clear' ? 'destructive' : 'outline'} className="capitalize">
                        {log.action_type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {summaryElements.length > 0 ? summaryElements : <span className="text-muted-foreground italic text-[10px]">Sem filtros</span>}
                      {log.deleted_count > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {log.deleted_count} rem.
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Detalhes da Auditoria</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="font-semibold">ID da Ação:</span>
                            <span className="font-mono text-xs">{log.id}</span>
                            <span className="font-semibold">Data/Hora:</span>
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                            <span className="font-semibold">Usuário:</span>
                            <span>{log.actor?.email || log.actor_id}</span>
                            <span className="font-semibold">Ação:</span>
                            <span className="capitalize">{log.action_type}</span>
                            {log.deleted_count > 0 && (
                              <>
                                <span className="font-semibold">Registros Removidos:</span>
                                <span>{log.deleted_count}</span>
                              </>
                            )}
                          </div>
                          <div className="space-y-2">
                            <span className="text-sm font-semibold">Payload Completo (Filtros):</span>
                            <pre className="bg-muted p-3 rounded-md text-[10px] overflow-auto max-h-[200px]">
                              {JSON.stringify(log.filters, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
