import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie, Legend } from "recharts";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, TrendingUp, AlertCircle, Calendar } from "lucide-react";

interface MetricsViewProps {
  metrics: any[];
}

export const MetricsView = ({ metrics }: MetricsViewProps) => {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      const date = new Date(m.created_at);
      if (startDate && date < new Date(startDate)) return false;
      if (endDate && date > new Date(endDate)) return false;
      return true;
    });
  }, [metrics, startDate, endDate]);

  const exportTimeData = useMemo(() => {
    return filteredMetrics
      .filter(m => m.operation === 'export')
      .slice(0, 30)
      .reverse()
      .map(m => ({
        name: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: m.duration_ms,
        rows: m.row_count,
        fullDate: new Date(m.created_at).toLocaleString()
      }));
  }, [filteredMetrics]);

  const failureByFilterData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredMetrics.forEach(m => {
      if (m.error_message) {
        // Find most relevant filter
        const f = m.filters || {};
        const key = f.type !== 'all' ? `Type:${f.type}` : (f.canvasId ? `Canvas:${f.canvasId}` : 'Other');
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredMetrics]);

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#3b82f6', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label htmlFor="metric-start" className="flex items-center gap-2"><Calendar className="w-3 h-3" /> Início</Label>
              <Input id="metric-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="metric-end" className="flex items-center gap-2"><Calendar className="w-3 h-3" /> Fim</Label>
              <Input id="metric-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <div>
                <CardTitle>Performance de Exportação</CardTitle>
                <CardDescription>Tempo de processamento (ms) e volume de dados exportados.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exportTimeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} fontSize={10} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} fontSize={10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Line yAxisId="left" type="monotone" dataKey="duration" stroke="#3b82f6" name="Duração (ms)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="rows" stroke="#10b981" name="Linhas" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <CardTitle>Falhas por Tipo de Filtro</CardTitle>
                <CardDescription>Distribuição de erros nas consultas.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={failureByFilterData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {failureByFilterData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <div>
                <CardTitle>Top Falhas Recentes</CardTitle>
                <CardDescription>Resumo dos últimos erros detectados.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredMetrics.filter(m => m.error_message).slice(0, 4).map((m, i) => (
                <div key={i} className="p-3 bg-destructive/5 rounded-lg border border-destructive/10 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-destructive uppercase">{m.operation}</span>
                    <span className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs font-medium line-clamp-2">{m.error_message}</p>
                </div>
              ))}
              {filteredMetrics.filter(m => m.error_message).length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <TrendingUp className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm italic">Nenhum erro no período.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
