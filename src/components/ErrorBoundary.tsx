import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  RotateCcw,
  Home,
  Bug,
  Copy,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { captureBoundaryError, addBreadcrumb, APP_RELEASE } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  resourceName?: string;
  fallback?: ReactNode;
  /** Only global boundaries should run the health check on mount to keep noise low. */
  global?: boolean;
}

type HealthState = "idle" | "checking" | "ok" | "degraded" | "down";

interface HealthCheck {
  name: string;
  status: "pending" | "ok" | "fail";
  detail?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  showDiagnostics: boolean;
  health: HealthState;
  checks: HealthCheck[];
  copied: boolean;
  consent: "granted" | "denied" | "unset";
  submitState: "idle" | "sending" | "sent" | "failed";
  submittedId: string | null;
  submitError: string | null;
}

const CONSENT_KEY = "kubo:crash-report-consent";


export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    showDiagnostics: false,
    health: "idle",
    checks: [],
    copied: false,
    consent: (typeof window !== "undefined" && (localStorage.getItem(CONSENT_KEY) as any)) || "unset",
    submitState: "idle",
    submittedId: null,
    submitError: null,
  };


  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
    try {
      (window as any).__lastFatalError = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        at: new Date().toISOString(),
        route: window.location.pathname + window.location.search,
      };
    } catch {}
    if (this.props.global) void this.runHealthCheck();
    // Auto-submit only when consent is granted
    if (this.state.consent === "granted") {
      // Wait a tick so health checks can populate
      setTimeout(() => void this.submitReport(error, errorInfo), 500);
    }
  }

  // ---- Consent ----
  private setConsent = (consent: "granted" | "denied") => {
    try { localStorage.setItem(CONSENT_KEY, consent); } catch {}
    this.setState({ consent });
    if (consent === "granted" && this.state.error) {
      void this.submitReport(this.state.error, this.state.errorInfo);
    }
  };

  // ---- Remote submit ----
  private submitReport = async (error: Error, errorInfo: ErrorInfo | null) => {
    if (this.state.submitState === "sending") return;
    this.setState({ submitState: "sending", submitError: null });
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !anon) throw new Error("Supabase env missing");
      // Best-effort auth token
      let authHeader: string | undefined;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) authHeader = `Bearer ${data.session.access_token}`;
      } catch {}
      const body = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        resource: this.props.resourceName ?? "App",
        route: window.location.pathname + window.location.search,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        retryCount: this.state.retryCount,
        health: this.state.checks.length ? { state: this.state.health, checks: this.state.checks } : null,
        metadata: { at: new Date().toISOString() },
      };
      const r = await fetch(`${url}/functions/v1/crash-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          ...(authHeader ? { Authorization: authHeader } : { Authorization: `Bearer ${anon}` }),
        },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      this.setState({ submitState: "sent", submittedId: data?.id ?? null });
    } catch (e: any) {
      console.error("[ErrorBoundary] submitReport failed:", e);
      this.setState({ submitState: "failed", submitError: e?.message || "failed" });
    }
  };

  // ---- Health check ----
  private runHealthCheck = async () => {
    this.setState({ health: "checking", checks: [
      { name: "Network", status: "pending" },
      { name: "Backend", status: "pending" },
      { name: "Auth session", status: "pending" },
      { name: "Local storage", status: "pending" },
    ]});
    const checks: HealthCheck[] = [];


    // 1. Network
    try {
      const r = await fetch(window.location.origin + "/favicon.svg", { cache: "no-store" });
      checks.push({ name: "Network", status: r.ok ? "ok" : "fail", detail: `HTTP ${r.status}` });
    } catch (e: any) {
      checks.push({ name: "Network", status: "fail", detail: e?.message ?? "fetch failed" });
    }

    // 2. Backend (supabase)
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL/KEY");
      const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
      checks.push({ name: "Backend", status: r.ok ? "ok" : "fail", detail: `HTTP ${r.status}` });
    } catch (e: any) {
      checks.push({ name: "Backend", status: "fail", detail: e?.message ?? "unreachable" });
    }

    // 3. Auth
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      checks.push({
        name: "Auth session",
        status: "ok",
        detail: data.session ? "signed in" : "signed out",
      });
    } catch (e: any) {
      checks.push({ name: "Auth session", status: "fail", detail: e?.message ?? "n/a" });
    }

    // 4. Local storage
    try {
      const k = "__eb_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      checks.push({ name: "Local storage", status: "ok" });
    } catch (e: any) {
      checks.push({ name: "Local storage", status: "fail", detail: e?.message ?? "blocked" });
    }

    const failed = checks.filter((c) => c.status === "fail").length;
    const health: HealthState = failed === 0 ? "ok" : failed >= 3 ? "down" : "degraded";
    this.setState({ checks, health });
  };

  // ---- Recovery ----
  private handleRetry = () => {
    // Soft recovery: try to remount subtree without full reload
    this.setState((s) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: s.retryCount + 1,
      showDiagnostics: false,
    }));
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = "/";
  };

  // ---- Report ----
  private buildReport = (): string => {
    const { error, errorInfo } = this.state;
    const lines = [
      "KUBO VIBE — Error Report",
      `When: ${new Date().toISOString()}`,
      `Route: ${window.location.pathname}${window.location.search}`,
      `User agent: ${navigator.userAgent}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight}`,
      `Retry count: ${this.state.retryCount}`,
      `Resource: ${this.props.resourceName ?? "App"}`,
      "",
      `Message: ${error?.message ?? "(unknown)"}`,
      "",
      "Stack:",
      error?.stack ?? "(no stack)",
      "",
      "Component stack:",
      errorInfo?.componentStack ?? "(no component stack)",
      "",
      "Health checks:",
      ...this.state.checks.map((c) => `  - ${c.name}: ${c.status}${c.detail ? ` (${c.detail})` : ""}`),
    ];
    return lines.join("\n");
  };

  private handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(this.buildReport());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback: prompt
      window.prompt("Copie o relatório manualmente:", this.buildReport());
    }
  };

  private handleReport = () => {
    // Prefer sending to backend if consent granted; otherwise fall back to mailto.
    if (this.state.consent === "granted" && this.state.error) {
      void this.submitReport(this.state.error, this.state.errorInfo);
      return;
    }
    const subject = encodeURIComponent(`[KUBO VIBE] Crash em ${this.props.resourceName ?? "App"}`);
    const body = encodeURIComponent(this.buildReport().slice(0, 1800));
    window.location.href = `mailto:support@kubovibe.dev?subject=${subject}&body=${body}`;
  };

  public render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { error, errorInfo, showDiagnostics, health, checks, retryCount, copied, consent, submitState, submittedId, submitError } = this.state;


    const healthBadge = () => {
      if (health === "idle") return null;
      if (health === "checking")
        return (
          <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verificando…</Badge>
        );
      if (health === "ok")
        return <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle2 className="h-3 w-3" /> Saudável</Badge>;
      if (health === "degraded")
        return <Badge className="gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30"><AlertTriangle className="h-3 w-3" /> Degradado</Badge>;
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Fora do ar</Badge>;
    };

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
        <div className="max-w-2xl w-full space-y-6 border border-border/60 p-8 rounded-2xl shadow-xl bg-card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-destructive/10 rounded-xl shrink-0">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">Algo deu errado</h1>
                {healthBadge()}
                {retryCount > 0 && (
                  <Badge variant="outline" className="text-[10px]">Tentativa #{retryCount + 1}</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                A tela em <span className="font-mono text-foreground">{this.props.resourceName ?? "App"}</span> travou.
                Nada foi perdido — você pode tentar novamente, recarregar ou reportar o problema.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-destructive/80 font-bold mb-1">Erro</div>
              <p className="font-mono text-xs break-words">{error.message}</p>
            </div>
          )}

          {/* Consent banner */}
          {consent === "unset" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="text-sm font-semibold">Enviar relatório de erro automaticamente?</div>
              <p className="text-xs text-muted-foreground">
                Podemos enviar detalhes técnicos deste crash (mensagem, stack, rota, user-agent) para os nossos servidores
                para ajudar a corrigir o problema. Nenhum dado pessoal do formulário é incluído. Você pode mudar de ideia depois.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => this.setConsent("granted")}>Permitir e enviar</Button>
                <Button size="sm" variant="ghost" onClick={() => this.setConsent("denied")}>Agora não</Button>
              </div>
            </div>
          )}

          {/* Submit status */}
          {consent === "granted" && submitState !== "idle" && (
            <div className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${
              submitState === "sent" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" :
              submitState === "failed" ? "border-destructive/30 bg-destructive/5 text-destructive" :
              "border-border/60 bg-muted/30 text-muted-foreground"
            }`}>
              {submitState === "sending" && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando relatório…</>)}
              {submitState === "sent" && (<><CheckCircle2 className="h-3.5 w-3.5" /> Relatório enviado{submittedId ? ` (id ${submittedId.slice(0, 8)})` : ""}. Obrigado!</>)}
              {submitState === "failed" && (
                <>
                  <XCircle className="h-3.5 w-3.5" /> Falha ao enviar: {submitError}
                  <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-xs" onClick={() => error && this.submitReport(error, errorInfo)}>
                    Tentar de novo
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={this.handleRetry} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Tentar novamente
            </Button>

            <Button variant="outline" onClick={this.handleReload} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Recarregar página
            </Button>
            <Button variant="outline" onClick={this.handleHome} className="gap-2">
              <Home className="h-4 w-4" /> Ir para início
            </Button>
            <Button variant="outline" onClick={this.runHealthCheck} className="gap-2">
              <Activity className="h-4 w-4" /> Rodar diagnóstico
            </Button>
            <Button variant="outline" onClick={this.handleCopy} className="gap-2">
              <Copy className="h-4 w-4" /> {copied ? "Copiado!" : "Copiar relatório"}
            </Button>
            <Button variant="destructive" onClick={this.handleReport} className="gap-2">
              <Bug className="h-4 w-4" /> {consent === "granted" ? "Reenviar relatório" : "Reportar problema"}
            </Button>
          </div>

          {checks.length > 0 && (
            <div className="rounded-lg border border-border/60 p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Health check</div>
              <ul className="space-y-1 text-xs">
                {checks.map((c) => (
                  <li key={c.name} className="flex items-center justify-between font-mono">
                    <span className="flex items-center gap-2">
                      {c.status === "ok" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : c.status === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                      {c.name}
                    </span>
                    <span className="text-muted-foreground">{c.detail ?? ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => this.setState({ showDiagnostics: !showDiagnostics })}
            >
              {showDiagnostics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showDiagnostics ? "Ocultar" : "Mostrar"} detalhes técnicos
            </button>
            {showDiagnostics && (
              <pre className="mt-2 p-3 bg-muted/40 rounded-lg text-[10px] font-mono overflow-auto max-h-64 border border-border/40 whitespace-pre-wrap">
                {this.buildReport()}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }
}
