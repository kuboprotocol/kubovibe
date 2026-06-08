import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  resourceName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center border border-border p-8 rounded-xl shadow-sm bg-card">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Falha em: {this.props.resourceName || "Recurso"}</h1>
              <p className="text-muted-foreground text-sm">
                Ocorreu um erro ao carregar os dados. Você pode tentar recarregar a página.
              </p>
              {this.state.error && (
                <div className="mt-4 p-3 bg-muted rounded text-[10px] font-mono text-left overflow-auto max-h-24 opacity-70">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex justify-center gap-3">
              <Button onClick={() => window.location.href = "/"}>
                Voltar ao Início
              </Button>
              <Button variant="outline" onClick={this.handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Recarregar Página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
