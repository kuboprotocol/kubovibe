
import { useState, useEffect } from "react";
import { 
  getTelemetryEvents, 
  clearTelemetry, 
  exportTelemetryAsJSON, 
  exportTelemetryAsCSV,
  TelemetryEvent 
} from "@/utils/pwaTelemetry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, Filter, Image as ImageIcon, FileCode, Type, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const PwaTelemetry = () => {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    setEvents(getTelemetryEvents());
  }, []);

  const handleClear = () => {
    if (confirm("Tem certeza que deseja limpar todos os dados de telemetria?")) {
      clearTelemetry();
      setEvents([]);
      toast.success("Dados de telemetria limpos.");
    }
  };

  const filteredEvents = filter === "all" 
    ? events 
    : events.filter(e => e.type === filter);

  const stats = {
    total: events.length,
    image: events.filter(e => e.type === "image").length,
    svg: events.filter(e => e.type === "svg").length,
    font: events.filter(e => e.type === "font").length,
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "image": return <Badge variant="secondary" className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> PNG</Badge>;
      case "svg": return <Badge variant="outline" className="flex items-center gap-1"><FileCode className="w-3 h-3" /> SVG</Badge>;
      case "font": return <Badge variant="default" className="flex items-center gap-1"><Type className="w-3 h-3" /> WOFF2</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PWA Telemetry</h1>
          <p className="text-muted-foreground">Monitoramento de fallbacks offline (PNG, SVG, WOFF2).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportTelemetryAsJSON}>
            <Download className="w-4 h-4 mr-2" /> JSON
          </Button>
          <Button variant="outline" onClick={exportTelemetryAsCSV}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button variant="destructive" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" /> Limpar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PNG Fallbacks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.image}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SVG Fallbacks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.svg}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">WOFF2 Fallbacks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.font}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Histórico de Eventos</CardTitle>
              <CardDescription>Lista detalhada de recursos que falharam offline.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="image">PNG</SelectItem>
                  <SelectItem value="svg">SVG</SelectItem>
                  <SelectItem value="font">WOFF2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="hidden md:table-cell">URL Completa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Nenhum evento registrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-xs font-mono">
                        {new Date(event.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{getTypeBadge(event.type)}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {event.url.split('/').pop()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                        {event.url}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PwaTelemetry;
