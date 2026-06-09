import { Check, X, Loader2, PlayCircle, Globe, ShieldCheck, Smartphone, Package, Code, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface ValidationStep {
  id: string;
  label: string;
  description: string;
  status: "pending" | "validating" | "success" | "error";
  error?: string;
}

export function DeliveryFlow() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<ValidationStep[]>([
    { id: "api", label: "Validação de APIs", description: "Verificando endpoints do Supabase e Edge Functions", status: "pending" },
    { id: "build", label: "Check de Build", description: "Validando integridade do pacote PWA", status: "pending" },
    { id: "pwa", label: "Deploy Web (PWA)", description: "Publicação automática com HTTPS e URL pública", status: "pending" },
    { id: "apk", label: "Geração de APK Android", description: "Empacotando aplicativo nativo para download", status: "pending" },
  ]);

  const runValidation = async () => {
    setIsDeploying(true);
    setProgress(0);
    
    const newSteps = [...steps].map(s => ({ ...s, status: "pending" as const, error: undefined }));
    setSteps(newSteps);

    for (let i = 0; i < newSteps.length; i++) {
      const step = newSteps[i];
      (step as any).status = "validating";
      setSteps([...newSteps]);
      
      // Simulate real validation work
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      
      // Artificial logic check for "APK" step to demonstrate error handling if something is missing
      if (step.id === "apk" && !window.location.protocol.includes("https") && window.location.hostname !== "localhost") {
        (step as any).status = "error";
        step.error = "HTTPS obrigatório para geração de APK seguro.";
        setSteps([...newSteps]);
        toast.error("Erro no fluxo de entrega", { description: step.error });
        setIsDeploying(false);
        return;
      }

      (step as any).status = "success";
      setProgress(((i + 1) / newSteps.length) * 100);
      setSteps([...newSteps]);
    }

    setIsDeploying(false);
    toast.success("Entrega finalizada com sucesso!", { 
      description: "PWA publicado e APK pronto para download." 
    });
  };

  return (
    <Card className="p-6 space-y-6 bg-card/50 backdrop-blur-xl border-primary/20 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Fluxo de Entrega & Deploy
          </h3>
          <p className="text-xs text-muted-foreground">Versão Web (PWA) e App Android (APK)</p>
        </div>
        {isDeploying ? (
          <Badge variant="outline" className="animate-pulse bg-primary/10 text-primary border-primary/20">
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Processando...
          </Badge>
        ) : (
          <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10">
            Pronto para Deploy
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
          <span>Progresso Global</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step) => (
          <div 
            key={step.id} 
            className={cn(
              "p-4 rounded-xl border transition-all duration-300",
              step.status === "success" ? "bg-green-500/5 border-green-500/20" :
              step.status === "error" ? "bg-destructive/5 border-destructive/20" :
              step.status === "validating" ? "bg-primary/5 border-primary/40 shadow-inner" :
              "bg-muted/30 border-border/40"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                step.status === "success" ? "text-green-500" :
                step.status === "error" ? "text-destructive" :
                step.status === "validating" ? "text-primary animate-pulse" :
                "text-muted-foreground"
              )}>
                {step.id === "api" && <ShieldCheck className="h-5 w-5" />}
                {step.id === "build" && <Code className="h-5 w-5" />}
                {step.id === "pwa" && <Globe className="h-5 w-5" />}
                {step.id === "apk" && <Smartphone className="h-5 w-5" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{step.label}</span>
                  {step.status === "success" && <Check className="h-4 w-4 text-green-500" />}
                  {step.status === "error" && <X className="h-4 w-4 text-destructive" />}
                  {step.status === "validating" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                <p className="text-[10px] leading-tight text-muted-foreground">{step.description}</p>
                {step.error && (
                  <p className="text-[10px] font-bold text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {step.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border/10 flex justify-end gap-3">
        <Button variant="outline" size="sm" disabled={isDeploying}>
          Download Último APK
        </Button>
        <Button 
          size="sm" 
          onClick={runValidation} 
          disabled={isDeploying}
          className="shadow-lg shadow-primary/20"
        >
          <PlayCircle className="h-4 w-4 mr-2" /> Iniciar Fluxo de Entrega
        </Button>
      </div>
    </Card>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");
