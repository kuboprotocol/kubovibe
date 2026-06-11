import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AuditViewProps {
  logs: any[];
}

export const AuditView = ({ logs }: AuditViewProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail Recente</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Resumo dos Filtros</TableHead>
              <TableHead>Info</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const filters = log.filters || {};
              const summary = Object.entries(filters)
                .filter(([_, v]) => v !== null && v !== "" && v !== "all")
                .map(([k, v]) => `${k}:${v}`)
                .join(", ") || "Sem filtros";

              return (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{log.actor?.email || log.actor_id}</TableCell>
                  <TableCell>
                    <Badge variant={log.action_type === 'clear' ? 'destructive' : 'outline'}>
                      {log.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[300px] truncate" title={summary}>
                    {summary}
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.deleted_count > 0 && `${log.deleted_count} rem.`}
                    {filters.format && `[${filters.format}]`}
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
