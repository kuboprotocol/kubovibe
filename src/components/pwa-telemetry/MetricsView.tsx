import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface MetricsViewProps {
  metrics: any[];
}

export const MetricsView = ({ metrics }: MetricsViewProps) => {
  const exportTimeData = metrics
    .filter(m => m.operation === 'export')
    .slice(0, 20)
    .reverse()
    .map(m => ({
      name: new Date(m.created_at).toLocaleTimeString(),
      duration: m.duration_ms,
      rows: m.row_count
    }));

  const failureData = metrics
    .filter(m => m.error_message)
    .reduce((acc: any[], m) => {
      const filterStr = JSON.stringify(m.filters);
      const existing = acc.find(i => i.filter === filterStr);
      if (existing) existing.count++;
      else acc.push({ filter: filterStr, count: 1 });
      return acc;
    }, [])
    .slice(0, 5);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tempo por Exportação (ms)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={exportTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="duration" fill="#3b82f6" name="Duração (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linhas Exportadas</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={exportTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="rows" stroke="#10b981" name="Linhas" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Falhas por Filtro (Top 5)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {failureData.length > 0 ? failureData.map((f, i) => (
              <div key={i} className="flex justify-between items-center border-b pb-2">
                <code className="text-xs truncate max-w-[80%]">{f.filter}</code>
                <span className="font-bold text-destructive">{f.count} falhas</span>
              </div>
            )) : <p className="text-muted-foreground text-center py-10">Nenhuma falha registrada recentemente.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
