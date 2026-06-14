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

      const isInvestigation = this.props.resourceName === "InvestigationPage";
      const isExport = this.props.resourceName === "ExportDetailsPage";
      const isPresets = this.props.resourceName === "PresetsPage";

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center border border-border p-8 rounded-xl shadow-sm bg-card">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {isInvestigation ? "Investigation Error" : isExport ? "Export Error" : isPresets ? "Presets Error" : `Failure in: ${this.props.resourceName || "Resource"}`}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isInvestigation 
                  ? "Could not load the failure investigation panel. Check your filters or try reloading." 
                  : isExport 
                    ? "There was a problem loading the export details. Export context has been preserved." 
                    : "An error occurred while loading data. You can try reloading the page."}
              </p>
              {this.state.error && (
                <div className="mt-4 p-3 bg-muted rounded text-[10px] font-mono text-left overflow-auto max-h-24 opacity-70">
                  <div className="font-semibold mb-1 opacity-50 uppercase tracking-wider">Error Context:</div>
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => window.location.href = "/creative"}>
                  Back to Dashboard
                </Button>
                <Button onClick={this.handleReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
              {isInvestigation && (
                <Button variant="link" size="sm" onClick={() => {
                  window.location.search = "";
                }}>
                  Clear Filters and Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
