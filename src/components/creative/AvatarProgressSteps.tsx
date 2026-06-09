import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AvatarStepKey = "upload" | "convert" | "generate" | "render";

export interface AvatarStepState {
  key: AvatarStepKey;
  label: string;
  status: "pending" | "active" | "done" | "skipped";
}

interface Props {
  steps: AvatarStepState[];
}

export function AvatarProgressSteps({ steps }: Props) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        Progresso da execução
      </p>
      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <li key={step.key} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold",
                step.status === "done" && "bg-primary text-primary-foreground border-primary",
                step.status === "active" && "border-primary text-primary",
                step.status === "pending" && "border-border text-muted-foreground",
                step.status === "skipped" && "border-border/40 text-muted-foreground/50"
              )}
            >
              {step.status === "done" ? (
                <Check className="h-3 w-3" />
              ) : step.status === "active" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <span
              className={cn(
                "text-sm",
                step.status === "active" && "font-semibold text-foreground",
                step.status === "done" && "text-foreground/80",
                (step.status === "pending" || step.status === "skipped") && "text-muted-foreground"
              )}
            >
              {step.label}
              {step.status === "skipped" && (
                <span className="ml-2 text-[10px] uppercase opacity-70">(não necessário)</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
