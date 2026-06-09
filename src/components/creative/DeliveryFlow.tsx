import { Check, X, Loader2, PlayCircle, Globe, ShieldCheck, Smartphone, Package, Code, AlertCircle, Terminal, History, Download, ExternalLink, QrCode, Filter, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ValidationStep {
  id: string;
  label: string;
  description: string;
  status: "pending" | "validating" | "success" | "error";
  error?: string;
}

interface DeployLog {
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
  step?: string;
}

interface DeployHistoryItem {
  id: string;
  date: string;
  environment: "staging" | "production";
  status: "success" | "error";
  commit: string;
  pwaUrl: string;
  apkUrl: string;
}

export function DeliveryFlow() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");
  const [logs, setLogs] = useState<DeployLog[]>([]);
  const [activeTab, setActiveTab] = useState("current");
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [showQR, setShowQR] = useState(false);

  const [steps, setSteps] = useState<ValidationStep[]>([
    { id: "build", label: "Build & Minificação", description: "Otimizando código e recursos para produção", status: "pending" },
    { id: "api", label: "Validação de Infra", description: "Configurando segredos e conexões do banco", status: "pending" },
    { id: "pwa", label: "Deploy Web (PWA)", description: "Publicação com HTTPS e Service Workers", status: "pending" },
    { id: "apk", label: "Assinatura & APK", description: "Gerando pacote assinado para Android", status: "pending" },
  ]);

  const [history, setHistory] = useState<DeployHistoryItem[]>(() => {
    const saved = localStorage.getItem("deploy_history");
    return saved ? JSON.parse(saved) : [
      { 
        id: "1", 
        date: new Date(Date.now() - 86400000).toISOString(), 
        environment: "production", 
        status: "success", 
        commit: "a1b2c3d", 
        pwaUrl: "https://kubovibe.app", 
        apkUrl: "#" 
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem("deploy_history", JSON.stringify(history));
  }, [history]);

  const addLog = (message: string, level: DeployLog["level"] = "info", step?: string) => {
    setLogs(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      step
    }, ...prev]);
  };

  const runValidation = async () => {
    setIsDeploying(true);
    setProgress(0);
    setLogs([]);
    const newSteps = steps.map(s => ({ ...s, status: "pending" as const, error: undefined }));
    setSteps(newSteps);

    addLog(`Iniciando deploy em ambiente: ${environment.toUpperCase()}`, "info");

    for (let i = 0; i < newSteps.length; i++) {
      const step = newSteps[i];
      step.status = "validating";
      setSteps([...newSteps]);
      
      addLog(`Processando etapa: ${step.label}...`, "info", step.id);
      
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
      
      if (step.id === "api" && Math.random() < 0.05) { // Small chance of simulated fail
        step.status = "error";
        step.error = "Falha na conexão com o banco de dados principal.";
        addLog(step.error, "error", step.id);
        setSteps([...newSteps]);
        setIsDeploying(false);
        return;
      }

      step.status = "success";
      addLog(`${step.label} concluído com sucesso.`, "success", step.id);
      setProgress(((i + 1) / newSteps.length) * 100);
      setSteps([...newSteps]);
    }

    const newItem: DeployHistoryItem = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      environment,
      status: "success",
      commit: Math.random().toString(36).substring(7),
      pwaUrl: environment === "production" ? "https://kubovibe.app" : "https://staging.kubovibe.app",
      apkUrl: "/downloads/app-latest.apk"
    };

    setHistory([newItem, ...history]);
    setIsDeploying(false);
    toast.success("Entrega finalizada!", { description: `App disponível em ${environment}` });
    addLog(`Deploy finalizado em ${newItem.pwaUrl}`, "success");
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.commit.toLowerCase().includes(historySearch.toLowerCase());
    const matchesFilter = historyFilter === "all" || item.environment === historyFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-xl border-primary/20 shadow-2xl overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Hub de Deploy
            </h3>
            <p className="text-xs text-muted-foreground">PWA, APK e Gestão de Ambientes</p>
          </div>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="current" className="text-xs">Atual</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Histórico</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="current" className="space-y-6 mt-0">
          <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/20">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Ambiente de Destino</span>
              <Select 
                value={environment} 
                onValueChange={(v: any) => setEnvironment(v)}
                disabled={isDeploying}
              >
                <SelectTrigger className="h-9 bg-background/50 border-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging (staging.kubovibe.app)</SelectItem>
                  <SelectItem value="production">Produção (kubovibe.app)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={runValidation} 
              disabled={isDeploying}
              className="h-9 shadow-lg shadow-primary/20"
            >
              {isDeploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              {isDeploying ? "Publicando..." : "Deploy Agora"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                <span>Progresso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              <div className="space-y-2">
                {steps.map((step) => (
                  <div key={step.id} className={cn(
                    "p-3 rounded-lg border flex items-center gap-3 transition-colors",
                    step.status === "validating" ? "border-primary/50 bg-primary/5" : "border-border/40"
                  )}>
                    {step.status === "success" ? <Check className="h-4 w-4 text-green-500" /> :
                     step.status === "validating" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
                     step.status === "error" ? <X className="h-4 w-4 text-destructive" /> :
                     <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />}
                    <div className="flex-1">
                      <p className="text-xs font-bold">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-none">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/20 bg-black/40 p-4 flex flex-col h-[300px]">
              <div className="flex items-center gap-2 mb-3 text-primary">
                <Terminal className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold">Logs em Tempo Real</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1.5 font-mono text-[10px]">
                  {logs.length === 0 && <p className="text-muted-foreground italic">Aguardando início do deploy...</p>}
                  {logs.map((log, i) => (
                    <div key={i} className={cn(
                      "flex gap-2 animate-in fade-in slide-in-from-left-1",
                      log.level === "error" ? "text-destructive" :
                      log.level === "success" ? "text-green-500" :
                      "text-muted-foreground"
                    )}>
                      <span className="opacity-50 shrink-0">[{log.timestamp}]</span>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {progress === 100 && !isDeploying && (
            <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 animate-in zoom-in-95">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Publicado com Sucesso!</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Conexão HTTPS ativa e segura
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog open={showQR} onOpenChange={setShowQR}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-2">
                        <QrCode className="h-3.5 w-3.5" /> QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xs text-center">
                      <DialogHeader>
                        <DialogTitle>Acesso Instantâneo</DialogTitle>
                      </DialogHeader>
                      <div className="bg-white p-4 rounded-lg mx-auto">
                         <div className="w-48 h-48 bg-gray-200 flex items-center justify-center border-2 border-dashed">
                           <QrCode className="h-12 w-12 text-gray-400" />
                         </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Escaneie para abrir o PWA</p>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" className="h-8 gap-2" asChild>
                    <a href="https://kubovibe.app" target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver Site
                    </a>
                  </Button>
                  <Button size="sm" className="h-8 gap-2 bg-green-600 hover:bg-green-700">
                    <Download className="h-3.5 w-3.5" /> Baixar APK
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por commit..." 
                className="pl-9 h-9"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <Filter className="h-3.5 w-3.5 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredHistory.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Nenhum deploy encontrado</p>
                </div>
              )}
              {filteredHistory.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-border/20 bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.environment === "production" ? "default" : "outline"} className="text-[9px] h-4">
                        {item.environment.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">#{item.commit}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                      <span className="text-xs font-medium">Deploy realizado com sucesso</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ver PWA">
                        <a href={item.pwaUrl} target="_blank"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Baixar APK">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

