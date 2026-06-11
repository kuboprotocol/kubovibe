
import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { 
  Download, Trash2, Filter, Image as ImageIcon, FileCode, 
  Type, Search, ChevronLeft, ChevronRight, LayoutGrid, List
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ITEMS_PER_PAGE = 20;

const PwaTelemetry = () => {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  const processedEvents = useMemo(() => {
    let result = [...events];
    
    if (filter !== "all") {
      result = result.filter(e => e.type === filter);
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => 
        e.url.toLowerCase().includes(s) || 
        e.sessionId.toLowerCase().includes(s)
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [events, filter, search, sortOrder]);

  const sessionSummary = useMemo(() => {
    const sessions: Record<string, {
      count: number;
      first: string;
      last: string;
      types: Record<string, number>;
    }> = {};

    events.forEach(e => {
      if (!sessions[e.sessionId]) {
        sessions[e.sessionId] = { count: 0, first: e.timestamp, last: e.timestamp, types: {} };
      }
      const s = sessions[e.sessionId];
      s.count++;
      s.types[e.type] = (s.types[e.type] || 0) + 1;
      if (new Date(e.timestamp) < new Date(s.first)) s.first = e.timestamp;
      if (new Date(e.timestamp) > new Date(s.last)) s.last = e.timestamp;
    });

    return Object.entries(sessions).map(([id, data]) => ({ id, ...data }));
  }, [events]);

  const totalPages = Math.ceil(processedEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = processedEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const stats = {
    total: events.length,
    image: events.filter(e => e.type === "image").length,
    svg: events.filter(e => e.type === "svg").length,
    font: events.filter(e => e.type === "font").length,
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "image": return <Badge variant="secondary" className="gap-1"><ImageIcon className="w-3 h-3" /> PNG</Badge>;
      case "svg": return <Badge variant="outline" className="gap-1"><FileCode className="w-3 h-3" /> SVG</Badge>;
      case "font": return <Badge variant="default" className="gap-1"><Type className="w-3 h-3" /> WOFF2</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PWA Audit & Telemetry</h1>
          <p className="text-muted-foreground">Monitoramento granular e agregados de sessões offline.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportTelemetryAsJSON(processedEvents)}>
            <Download className="w-4 h-4 mr-2" /> JSON
          </Button>
          <Button variant="outline" onClick={() => exportTelemetryAsCSV(processedEvents)}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button variant="destructive" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" /> Limpar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: stats.total },
          { label: "PNG Fallbacks", value: stats.image },
          { label: "SVG Fallbacks", value: stats.svg },
          { label: "WOFF2 Fallbacks", value: stats.font },
        ].map((s, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list" className="gap-2"><List className="w-4 h-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2"><LayoutGrid className="w-4 h-4" /> Resumo por Sessão</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por URL ou Session ID..." 
                    className="pl-9"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filter} onValueChange={(v) => { setFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="image">PNG</SelectItem>
                      <SelectItem value="svg">SVG</SelectItem>
                      <SelectItem value="font">WOFF2</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Ordem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Mais recentes</SelectItem>
                      <SelectItem value="asc">Mais antigos</SelectItem>
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
                      <TableHead>Sessão (ID)</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Arquivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          Nenhum evento corresponde aos filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-xs font-mono">
                            {new Date(event.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {event.sessionId.slice(0, 8)}...
                          </TableCell>
                          <TableCell>{getTypeBadge(event.type)}</TableCell>
                          <TableCell className="font-medium truncate max-w-[300px]" title={event.url}>
                            {event.url.split('/').pop()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-medium">
                    Página {currentPage} de {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessionSummary.map(s => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono truncate">ID: {s.id}</CardTitle>
                  <CardDescription>
                    {new Date(s.first).toLocaleDateString()} {new Date(s.first).toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-2xl font-bold">{s.count}</div>
                      <div className="text-xs text-muted-foreground">Total de Fallbacks</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">Duração</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round((new Date(s.last).getTime() - new Date(s.first).getTime()) / 1000 / 60)} min
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(s.types).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-1.5 text-xs bg-secondary px-2 py-1 rounded-md">
                        {getTypeBadge(type)}
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PwaTelemetry;
