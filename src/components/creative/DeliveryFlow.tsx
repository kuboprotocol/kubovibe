import { Check, X, Loader2, PlayCircle, Globe, ShieldCheck, Smartphone, Package, Code, AlertCircle, Terminal, History, Download, ExternalLink, QrCode, Filter, Search, Mail, Bell, FileJson, FileSpreadsheet, FileText, UserCheck, RotateCcw, FileBadge, Lock, MessageSquare, ShieldAlert, Activity, Cpu, Upload, Paperclip, Eye, Clock, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  status: "success" | "error" | "blocked";
  commit: string;
  pwaUrl: string;
  apkUrl: string;
  logs: DeployLog[];
  failedStepId?: string;
  user?: string;
  evidence?: string[];
  healthStatus?: "up" | "down" | "unchecked";
  healthDetails?: string;
  parameters: {
    environment: "staging" | "production";
    notifications: { email: boolean; webhook: boolean };
    commit: string;
    dryRun?: boolean;
    approvalComment?: string;
    approvalTerms?: boolean;
    healthCheck?: boolean;
    evidenceCount?: number;
  };
}

interface ActiveDeploy {
  id: string;
  environment: string;
  user: string;
  timestamp: string;
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
  const [notifications, setNotifications] = useState({ email: true, webhook: false });
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin"); // Mock role: 'admin', 'developer', 'viewer'
  const [pendingApproval, setPendingApproval] = useState<boolean>(false);
  const [currentCommit, setCurrentCommit] = useState<string>(() => Math.random().toString(36).substring(7));
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalTerms, setApprovalTerms] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [activeDeploys, setActiveDeploys] = useState<ActiveDeploy[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [maxEvidenceSize] = useState(5 * 1024 * 1024); // 5MB limit
  const [allowedTypes] = useState(["image/png", "image/jpeg", "application/pdf", "text/plain"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [steps, setSteps] = useState<ValidationStep[]>([
    { id: "ci", label: "CI & Testes de Integração", description: "Executando suíte de testes automatizados", status: "pending" },
    { id: "build", label: "Build & Minificação", description: "Otimizando código e recursos para produção", status: "pending" },
    { id: "api", label: "Validação de Infra", description: "Configurando segredos e conexões do banco", status: "pending" },
    { id: "pwa", label: "Deploy Web (PWA)", description: "Publicação com HTTPS e Service Workers", status: "pending" },
    { id: "apk", label: "Assinatura & APK", description: "Gerando pacote assinado para Android", status: "pending" },
  ]);

  const [history, setHistory] = useState<DeployHistoryItem[]>(() => {
    const saved = localStorage.getItem("deploy_history");
    return saved ? JSON.parse(saved) : [];
  });


  const canExecuteDeploy = useMemo(() => {
    if (environment === "production") return currentUserRole === "admin";
    return currentUserRole === "admin" || currentUserRole === "developer";
  }, [environment, currentUserRole]);

  useEffect(() => {
    localStorage.setItem("deploy_history", JSON.stringify(history));
  }, [history]);

  const addLog = (message: string, level: DeployLog["level"] = "info", step?: string) => {
    const newLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      step
    };
    setLogs(prev => [newLog, ...prev]);
    return newLog;
  };

  const notifyResult = async (status: "success" | "error", env: string, attempt = 1, pwaUrl?: string, evidence?: string[]) => {
    // Retry logic & Deduplication (simulated)
    const notificationPayload = {
      status,
      environment: env,
      timestamp: new Date().toISOString(),
      pwaUrl: pwaUrl || "https://kubovibe.app",
      steps: steps.map(s => ({ id: s.id, label: s.label, status: s.status })),
      evidenceReferences: evidence || []
    };

    if (notifications.email) {
      console.log(`[Notification] Enviando e-mail de resumo (Tentativa ${attempt})...`, notificationPayload);
      try {
        // Mock success with 90% chance
        if (Math.random() < 0.9) {
          toast.success(`E-mail de notificação enviado (${status})`);
        } else throw new Error("Falha no servidor de e-mail");
      } catch (err) {
        if (attempt < 3) {
          console.warn("Retrying email notification...");
          setTimeout(() => notifyResult(status, env, attempt + 1, pwaUrl, evidence), 2000);
        } else {
          toast.error("Falha ao enviar e-mail após 3 tentativas");
        }
      }
    }

    if (notifications.webhook) {
      console.log(`[Notification] Disparando webhook para Slack/Teams (Tentativa ${attempt})...`, notificationPayload);
      toast.info(`Webhook disparado para o ambiente ${env}`);
    }
  };

  const runValidation = async (resumeFromStepId?: string, previousLogs: DeployLog[] = [], forcedCommit?: string) => {
    if (!canExecuteDeploy) {
      toast.error("Permissão negada", { description: "Você não tem permissão para realizar deploy neste ambiente." });
      return;
    }

    // Check for concurrent deploys in the same environment
    const environmentLock = activeDeploys.find(d => d.environment === environment);
    if (environmentLock && !isDryRun) {
      toast.error("Bloqueio de Ambiente", { 
        description: `O ambiente ${environment.toUpperCase()} já está em deploy por ${environmentLock.user}. Aguarde a conclusão.` 
      });
      
      const blockedItem: DeployHistoryItem = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        environment,
        status: "blocked",
        commit: currentCommit,
        pwaUrl: "",
        apkUrl: "",
        logs: [{ timestamp: new Date().toLocaleTimeString(), level: "warning", message: `Tentativa de deploy bloqueada por concorrência (Usuário: ${currentUserRole})` }],
        user: currentUserRole,
        parameters: { environment, notifications, commit: currentCommit }
      };
      setHistory(prev => [blockedItem, ...prev]);
      addLog(`Tentativa de deploy bloqueada por concorrência em ${environment.toUpperCase()} (Usuário: ${currentUserRole})`, "warning");
      return;
    }


    // Require approval for production if not admin
    if (environment === "production" && currentUserRole !== "admin" && !pendingApproval) {
      setPendingApproval(true);
      toast.info("Aprovação Solicitada", { description: "Aguardando aprovação de um administrador para deploy em produção." });
      return;
    }

    if (environment === "production" && !isDryRun) {
      if (!approvalComment.trim() || !approvalTerms) {
        toast.error("Campos Obrigatórios", { description: "É necessário fornecer um comentário e aceitar os termos de aprovação." });
        setPendingApproval(true);
        return;
      }
    }

    const deployId = crypto.randomUUID();
    if (!isDryRun) {
      setActiveDeploys(prev => [...prev, { id: deployId, environment, user: currentUserRole, timestamp: new Date().toISOString() }]);
    }

    setIsDeploying(true);
    setPendingApproval(false);
    setProgress(0);
    
    let currentLogs = resumeFromStepId ? [...previousLogs] : [];
    if (!resumeFromStepId) {
      setLogs([]);
      currentLogs = [];
      if (!forcedCommit) setCurrentCommit(Math.random().toString(36).substring(7));
    } else {
      setLogs(currentLogs);
    }
    const finalCommit = forcedCommit || currentCommit;

    const startIdx = resumeFromStepId ? steps.findIndex(s => s.id === resumeFromStepId) : 0;
    const newSteps: ValidationStep[] = steps.map((s, idx) => {
      if (idx < startIdx) return { ...s, status: "success" as const };
      return { ...s, status: "pending" as const, error: undefined };
    });
    setSteps(newSteps);

    addLog(`${isDryRun ? "[DRY-RUN] " : ""}${resumeFromStepId ? "Retomando" : "Iniciando"} deploy em ambiente: ${environment.toUpperCase()} (Commit: ${finalCommit})`, "info");

    let finalStatus: "success" | "error" = "success";
    let failedStepId: string | undefined;

    for (let i = startIdx; i < newSteps.length; i++) {
      const step = newSteps[i];
      step.status = "validating" as const;
      setSteps([...newSteps]);
      
      addLog(`Processando etapa: ${step.label}...`, "info", step.id);
      
      // Simulating build/upload integration tests during dry-run or real deploy
      if (step.id === "ci") {
        addLog("Executando testes automatizados de integração...", "info", step.id);
        addLog("Validando parâmetros, credenciais e etapas de build/upload...", "info", step.id);
        await new Promise(r => setTimeout(r, 1200));
        addLog("Suite de testes concluída: 42 testes passaram, 0 falharam.", "success", step.id);
      }

      if (step.id === "build") {
        addLog("Validando parâmetros e credenciais de build...", "info", step.id);
        await new Promise(r => setTimeout(r, 800));
      }

      await new Promise(r => setTimeout(r, 1500));

      
      if (isDryRun && Math.random() < 0.1) {
        step.status = "error" as const;
        step.error = "Simulação de falha em modo Dry-Run.";
        addLog(step.error, "error", step.id);
        finalStatus = "error";
        failedStepId = step.id;
        break;
      }

      if (!isDryRun && step.id === "api" && Math.random() < 0.2) {
        step.status = "error" as const;
        step.error = "Falha na validação de credenciais da API.";
        addLog(step.error, "error", step.id);
        setSteps([...newSteps]);
        finalStatus = "error";
        failedStepId = step.id;
        break;
      }

      step.status = "success" as const;
      addLog(`${step.label} concluído com sucesso.`, "success", step.id);
      setProgress(((i + 1) / newSteps.length) * 100);
      setSteps([...newSteps]);
    }

    // Post-deploy health check with retries and window
    let healthStatus: "up" | "down" | "unchecked" = "unchecked";
    let healthDetails = "";
    if (finalStatus === "success" && !isDryRun) {
      addLog("Iniciando Health-Check automático do link público (Janela de 30s)...", "info");
      
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        attempts++;
        addLog(`Verificando disponibilidade (Tentativa ${attempts}/${maxAttempts})...`, "info");
        await new Promise(r => setTimeout(r, 2000));
        
        const isUp = Math.random() > 0.2; // 80% chance of being up in simulation
        if (isUp) {
          healthStatus = "up";
          healthDetails = "Status 200 OK - Resposta em 142ms. Link público acessível.";
          addLog(`Health-Check: ONLINE (200 OK)`, "success");
          break;
        } else {
          addLog(`Health-Check: OFFLINE / ERRO 500 (Aguardando propagação...)`, "warning");
          if (attempts === maxAttempts) {
            healthStatus = "down";
            healthDetails = "Falha após 3 tentativas. Erro 503 Service Unavailable ou Timeout.";
            addLog(`Health-Check: FALHA DEFINITIVA após ${maxAttempts} tentativas`, "error");
          } else {
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      }
    }


    const newItem: DeployHistoryItem = {
      id: deployId,
      date: new Date().toISOString(),
      environment,
      status: finalStatus,
      commit: finalCommit,
      pwaUrl: environment === "production" ? "https://kubovibe.app" : "https://staging.kubovibe.app",
      apkUrl: "/downloads/app-latest.apk",
      logs: [...currentLogs, ...logs],
      failedStepId,
      healthStatus,
      healthDetails,
      user: currentUserRole,
      evidence: evidenceFiles.map(f => f.name),
      parameters: {
        environment,
        notifications: { ...notifications },
        commit: finalCommit,
        dryRun: isDryRun,
        approvalComment: environment === "production" ? approvalComment : undefined,
        approvalTerms: environment === "production" ? approvalTerms : undefined,
        healthCheck: true,
        evidenceCount: evidenceFiles.length
      }
    };


    if (!isDryRun) {
      setHistory(prev => [newItem, ...prev]);
    }
    
    setIsDeploying(false);
    setActiveDeploys(prev => prev.filter(d => d.id !== deployId));
    setEvidenceFiles([]);
    setApprovalComment("");
    setApprovalTerms(false);

    
    if (finalStatus === "success") {
      toast.success(isDryRun ? "Simulação finalizada com sucesso!" : "Entrega finalizada!", { 
        description: isDryRun ? "Nenhuma alteração real foi feita." : `App disponível em ${environment}` 
      });
      if (!isDryRun) addLog(`Deploy finalizado com sucesso em ${newItem.pwaUrl}`, "success");
    } else {
      toast.error(isDryRun ? "Simulação falhou" : "Deploy falhou", { 
        description: `Erro na etapa: ${steps.find(s => s.id === failedStepId)?.label}` 
      });
    }

    if (!isDryRun) notifyResult(finalStatus, environment, 1, newItem.pwaUrl, newItem.evidence);
  };

  const downloadLogs = (historyItem: DeployHistoryItem, format: "json" | "csv") => {
    const content = format === "json" 
      ? JSON.stringify(historyItem, null, 2)
      : "Timestamp,Level,Step,Message\n" + historyItem.logs.map(l => `${l.timestamp},${l.level},${l.step || ""},"${l.message}"`).join("\n");
    
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deploy-logs-${historyItem.commit}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Logs exportados em ${format.toUpperCase()}`);
  };

  const downloadAuditSummary = (historyItem: DeployHistoryItem) => {
    // Simulating full Audit PDF summary
    const summary = `
=========================================
RELATÓRIO DE AUDITORIA DE DEPLOY (PDF SIMULATED)
=========================================
Identificador Único: ${historyItem.id}
Data e Hora: ${new Date(historyItem.date).toLocaleString()}
Responsável: ${currentUserRole.toUpperCase()}
-----------------------------------------
RESUMO DA EXECUÇÃO
-----------------------------------------
Ambiente: ${historyItem.environment.toUpperCase()}
Status Final: ${historyItem.status.toUpperCase()}
Versão (Commit): ${historyItem.commit}
URL Pública: ${historyItem.pwaUrl}
HTTPS: HABILITADO E VERIFICADO
Health-Check: ${historyItem.healthStatus?.toUpperCase() || "NÃO EXECUTADO"}
Detalhes Health: ${historyItem.healthDetails || "N/A"}
-----------------------------------------
DETALHES DE APROVAÇÃO (PRODUÇÃO)
-----------------------------------------
Responsável: ${historyItem.user || "Admin"}
Comentário: ${historyItem.parameters.approvalComment || "N/A"}
Evidências Anexadas: ${historyItem.evidence?.join(", ") || "Nenhuma"}
Termos Aceitos: ${historyItem.parameters.approvalTerms ? "SIM" : "NÃO"}

-----------------------------------------
MODO DE EXECUÇÃO: ${historyItem.parameters.dryRun ? "DRY-RUN (SIMULAÇÃO)" : "REAL (PRODUÇÃO/STAGING)"}
-----------------------------------------
TIMELINE DE ETAPAS
-----------------------------------------
${steps.map(s => {
  const isFailed = historyItem.failedStepId === s.id;
  return `[${isFailed ? "FALHA" : "OK"}] ${s.label}: ${s.description}`;
}).join("\n")}
-----------------------------------------
PARÂMETROS UTILIZADOS
-----------------------------------------
Notificações E-mail: ${historyItem.parameters.notifications.email ? "SIM" : "NÃO"}
Notificações Webhook: ${historyItem.parameters.notifications.webhook ? "SIM" : "NÃO"}
Retomado de etapa anterior: ${historyItem.failedStepId ? "SIM" : "NÃO"}
-----------------------------------------
LOGS DE ACESSO
-----------------------------------------
Link para logs JSON: /api/logs/${historyItem.id}.json
Link para logs CSV: /api/logs/${historyItem.id}.csv
=========================================
Documento assinado digitalmente por Lovable Cloud Deploy Engine.
    `;
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-deploy-${historyItem.commit}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório de auditoria gerado e baixado");
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.commit.toLowerCase().includes(historySearch.toLowerCase());
    const matchesFilter = historyFilter === "all" || item.environment === historyFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-xl border-primary/20 shadow-2xl overflow-hidden">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] gap-1 px-2 py-0.5">
          <UserCheck className="h-2.5 w-2.5" /> {currentUserRole.toUpperCase()}
        </Badge>
        <Select value={currentUserRole} onValueChange={setCurrentUserRole}>
          <SelectTrigger className="w-[100px] h-6 text-[9px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="developer">Dev</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4 bg-muted/30 p-4 rounded-xl border border-border/20">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] space-y-1">
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
                      <SelectItem value="staging">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5" /> Staging (staging.kubovibe.app)
                        </div>
                      </SelectItem>
                      <SelectItem value="production">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Produção (kubovibe.app)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Dialog open={pendingApproval} onOpenChange={setPendingApproval}>
                    <DialogTrigger asChild>
                      <Button 
                        disabled={isDeploying || !canExecuteDeploy}
                        className={cn(
                          "h-9 shadow-lg",
                          environment === "production" ? "bg-primary hover:bg-primary/90" : "bg-primary shadow-primary/20"
                        )}
                      >
                        {isDeploying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 
                         isDryRun ? <Activity className="h-4 w-4 mr-2" /> :
                         <PlayCircle className="h-4 w-4 mr-2" />}
                        {isDeploying ? "Publicando..." : 
                         isDryRun ? "Simular Deploy" : "Deploy Agora"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <ShieldAlert className="h-5 w-5 text-primary" />
                          Aprovação de Deploy - {environment.toUpperCase()}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="p-3 bg-muted/50 rounded-lg border border-border/40 text-[11px] space-y-2">
                          <p className="font-bold flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5" /> Política de Segurança
                          </p>
                          <p>O deploy em {environment.toUpperCase()} exige justificativa, evidências e aceitação dos termos.</p>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-bold flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" /> Justificativa e Testes Realizados
                          </label>
                          <Textarea 
                            placeholder="Descreva as alterações e resultados dos testes manuais..."
                            value={approvalComment}
                            onChange={(e) => setApprovalComment(e.target.value)}
                            className="text-xs min-h-[80px]"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold flex items-center justify-between">
                            <span className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5" /> Evidências (Prints/Logs)</span>
                            <span className="text-[10px] text-muted-foreground font-normal">Máx. 5MB</span>
                          </label>
                          <div 
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files) {
                                const files = Array.from(e.dataTransfer.files);
                                const validFiles = files.filter(f => {
                                  if (f.size > maxEvidenceSize) {
                                    toast.error(`Arquivo ${f.name} excede 5MB`);
                                    return false;
                                  }
                                  if (!allowedTypes.includes(f.type)) {
                                    toast.error(`Tipo ${f.type} não permitido`);
                                    return false;
                                  }
                                  return true;
                                });
                                setEvidenceFiles(prev => [...prev, ...validFiles]);
                              }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 hover:border-primary/40 transition-all group"
                          >
                            <input 
                              type="file" 
                              multiple 
                              className="hidden" 
                              ref={fileInputRef}
                              onChange={(e) => {
                                if (e.target.files) {
                                  const files = Array.from(e.target.files);
                                  const validFiles = files.filter(f => f.size <= maxEvidenceSize && allowedTypes.includes(f.type));
                                  setEvidenceFiles(prev => [...prev, ...validFiles]);
                                }
                              }}
                            />
                            <div className="flex flex-col items-center gap-1">
                              <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
                              <p className="text-xs font-medium">Arraste ou clique para anexar</p>
                              <p className="text-[10px] text-muted-foreground">PNG, JPG, PDF ou TXT</p>
                            </div>
                          </div>
                          {evidenceFiles.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {evidenceFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between bg-muted/30 p-2 rounded-md border border-border/40 animate-in fade-in slide-in-from-top-1">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="text-[10px] truncate">{f.name}</span>
                                    <span className="text-[8px] text-muted-foreground">({(f.size / 1024).toFixed(0)}KB)</span>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 hover:text-destructive" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEvidenceFiles(prev => prev.filter((_, idx) => idx !== i));
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-start gap-2 pt-2">
                          <Checkbox 
                            id="terms" 
                            checked={approvalTerms}
                            onCheckedChange={(v) => setApprovalTerms(!!v)}
                            className="mt-0.5"
                          />
                          <label htmlFor="terms" className="text-[11px] leading-tight cursor-pointer">
                            Eu confirmo que validei as APIs, anexei evidências e assumo a responsabilidade por este deploy em {environment.toUpperCase()}.
                          </label>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="text-[11px] font-bold">Modo Dry-Run</span>
                          </div>
                          <Checkbox 
                            checked={isDryRun}
                            onCheckedChange={(v) => setIsDryRun(!!v)}
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingApproval(false)}>Cancelar</Button>
                        <Button 
                          onClick={() => runValidation()}
                          disabled={environment === "production" && (!approvalComment.trim() || !approvalTerms)}
                        >
                          Confirmar e Iniciar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                {!canExecuteDeploy ? (
                  <div className="flex items-center gap-2 text-[10px] text-destructive font-bold p-2 bg-destructive/10 rounded-lg flex-1 mr-4">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Seu cargo ({currentUserRole}) não permite deploy em {environment.toUpperCase()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-primary font-bold p-2 bg-primary/5 rounded-lg flex-1 mr-4">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Acesso autorizado para {environment.toUpperCase()}
                  </div>
                )}
                
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Simulação</span>
                    <Checkbox checked={isDryRun} onCheckedChange={(v) => setIsDryRun(!!v)} />
                  </div>
                  {activeDeploys.length > 0 && (
                    <Badge variant="destructive" className="animate-pulse gap-1 text-[9px]">
                      <Cpu className="h-2.5 w-2.5" /> DEPLOY CONCORRENTE ATIVO
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border border-border/20 space-y-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                <Bell className="h-3 w-3" /> Notificações
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="notify-email" className="text-xs flex items-center gap-2 cursor-pointer">
                    <Mail className="h-3.5 w-3.5" /> E-mail
                  </label>
                  <Checkbox 
                    id="notify-email" 
                    checked={notifications.email} 
                    onCheckedChange={(v) => setNotifications(p => ({ ...p, email: !!v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label htmlFor="notify-webhook" className="text-xs flex items-center gap-2 cursor-pointer">
                    <Code className="h-3.5 w-3.5" /> Webhook (Slack)
                  </label>
                  <Checkbox 
                    id="notify-webhook" 
                    checked={notifications.webhook} 
                    onCheckedChange={(v) => setNotifications(p => ({ ...p, webhook: !!v }))}
                  />
                </div>
              </div>
            </div>
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
                <div key={item.id} className={cn(
                  "p-4 rounded-xl border transition-colors",
                  item.status === "blocked" ? "border-destructive/30 bg-destructive/5" : "border-border/20 bg-muted/20 hover:bg-muted/30"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.environment === "production" ? "default" : "outline"} className="text-[9px] h-4">
                        {item.environment.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">#{item.commit}</span>
                      {item.status === "blocked" && (
                        <Badge variant="destructive" className="text-[8px] h-3 px-1">BLOQUEADO</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(item.date).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        item.status === "success" ? "bg-green-500/10" : "bg-destructive/10"
                      )}>
                        {item.status === "success" ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {item.status === "success" ? "Deploy realizado com sucesso" : 
                             item.status === "blocked" ? "Tentativa de deploy bloqueada" : "Deploy falhou"}
                            {item.parameters.dryRun && <Badge variant="outline" className="ml-2 text-[8px] h-3 border-orange-500 text-orange-500">DRY-RUN</Badge>}
                          </span>
                          <span className="text-[9px] text-muted-foreground italic flex items-center gap-1">
                            por <UserCheck className="h-2.5 w-2.5" /> {item.user || "admin"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.failedStepId && (
                            <span className="text-[10px] text-destructive font-medium">
                              Falha na etapa: {steps.find(s => s.id === item.failedStepId)?.label}
                            </span>
                          )}
                          {item.healthStatus && item.healthStatus !== "unchecked" && (
                            <Badge variant={item.healthStatus === "up" ? "outline" : "destructive"} className="text-[8px] h-3 gap-1">
                              {item.healthStatus === "up" ? <Check className="h-2 w-2" /> : <X className="h-2 w-2" />}
                              HEALTH: {item.healthStatus.toUpperCase()}
                            </Badge>
                          )}
                          {item.parameters.approvalComment && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                              <MessageSquare className="h-2.5 w-2.5" /> {item.parameters.approvalComment.substring(0, 30)}...
                            </span>
                          )}
                          {item.evidence && item.evidence.length > 0 && (
                            <span className="text-[9px] text-primary flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded">
                              <Paperclip className="h-2.5 w-2.5" /> {item.evidence.length} evidências
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[10px]">
                            <Eye className="h-3.5 w-3.5" /> Revisar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Detalhes da Execução #{item.commit}</DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-2 gap-4 py-4">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Ambiente & Status</p>
                                <div className="flex items-center gap-2">
                                  <Badge>{item.environment.toUpperCase()}</Badge>
                                  <Badge variant={item.status === "success" ? "outline" : "destructive"}>{item.status.toUpperCase()}</Badge>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Responsável</p>
                                <p className="text-xs font-mono">{item.user || "admin"}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Justificativa</p>
                                <p className="text-xs italic bg-muted p-2 rounded border">{item.parameters.approvalComment || "Nenhuma justificativa fornecida"}</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Health Check</p>
                                <p className="text-xs">{item.healthDetails || "Não executado"}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Evidências ({item.evidence?.length || 0})</p>
                                <div className="space-y-1">
                                  {item.evidence?.map((f, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-muted/30 p-1.5 rounded border border-border/40">
                                      <span className="text-[10px] truncate max-w-[150px]">{f}</span>
                                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toast.info(`Iniciando download de ${f}`)}>
                                        <Download className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )) || <span className="text-[10px] text-muted-foreground">Nenhuma evidência anexada</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                          <DialogFooter className="sm:justify-start">
                            <Button variant="outline" size="sm" onClick={() => downloadAuditSummary(item)}>
                              <FileBadge className="h-3.5 w-3.5 mr-2" /> PDF Auditoria
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {item.status === "error" && item.failedStepId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-1.5 text-xs text-primary"
                          onClick={() => {
                            setEnvironment(item.parameters.environment);
                            setNotifications(item.parameters.notifications);
                            setCurrentCommit(item.parameters.commit);
                            setActiveTab("current");
                            runValidation(item.failedStepId, item.logs, item.parameters.commit);
                          }}
                        >
                          <RotateCcw className="h-3 w-3" /> Retomar
                        </Button>

                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Exportar Logs">
                            <FileJson className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Exportar Logs e Auditoria</DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-1 gap-4 py-4">
                            <Button variant="outline" className="justify-start gap-2" onClick={() => downloadLogs(item, "json")}>
                              <FileJson className="h-4 w-4 text-orange-500" /> Baixar em JSON
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => downloadLogs(item, "csv")}>
                              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Baixar em CSV
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => downloadAuditSummary(item)}>
                              <FileBadge className="h-4 w-4 text-blue-500" /> Relatório de Auditoria Completo (PDF/TXT)
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
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

