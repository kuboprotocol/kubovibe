import { Check, Loader2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AvatarStepKey = "upload" | "convert" | "generate" | "render";

export interface AvatarStepState {
  key: AvatarStepKey;
  label: string;
  status: "pending" | "active" | "done" | "skipped" | "error";
  timestamp?: string;
  errorMessage?: string;
}

interface Props {
  steps: AvatarStepState[];
}

export function AvatarProgressSteps({ steps }: Props) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
          Progresso da execução
        </p>
        <Clock className="h-3 w-3 text-muted-foreground/50" />
      </div>
      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <li key={step.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
                <div
                className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold transition-colors",
                    step.status === "done" && "bg-primary text-primary-foreground border-primary",
                    step.status === "active" && "border-primary text-primary",
                    step.status === "pending" && "border-border text-muted-foreground",
                    step.status === "skipped" && "border-border/40 text-muted-foreground/50",
                    step.status === "error" && "bg-destructive text-destructive-foreground border-destructive"
                )}
                >
                {step.status === "done" ? (
                    <Check className="h-3 w-3" />
                ) : step.status === "active" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : step.status === "error" ? (
                    <AlertCircle className="h-3 w-3" />
                ) : (
                    <span>{idx + 1}</span>
                )}
                </div>
                <div className="flex-1 flex items-center justify-between">
                    <span
                        className={cn(
                            "text-sm",
                            step.status === "active" && "font-semibold text-foreground",
                            step.status === "done" && "text-foreground/80",
                            (step.status === "pending" || step.status === "skipped") && "text-muted-foreground",
                            step.status === "error" && "text-destructive font-medium"
                        )}
                    >
                        {step.label}
                        {step.status === "skipped" && (
                            <span className="ml-2 text-[10px] uppercase opacity-70">(não necessário)</span>
                        )}
                    </span>
                    {step.timestamp && (
                        <span className="text-[9px] text-muted-foreground font-mono">
                            {step.timestamp}
                        </span>
                    )}
                </div>
            </div>
            {step.errorMessage && (
                <p className="ml-9 text-[11px] text-destructive/90 leading-tight">
                    {step.errorMessage}
                </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
