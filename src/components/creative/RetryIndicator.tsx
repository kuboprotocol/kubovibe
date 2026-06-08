import React from "react";
import { AlertCircle, History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RetryIndicatorProps {
  failureCount: number;
  error: Error | null;
  onRetry: () => void;
  isLoading: boolean;
  maxRetries?: number;
}

export function RetryIndicator({ failureCount, error, onRetry, isLoading, maxRetries = 3 }: RetryIndicatorProps) {
  if (failureCount === 0 && !error) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-xs font-semibold text-destructive">
          Falha na conexão ({failureCount}/{maxRetries})
        </p>
        {error && (
          <p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={error.message}>
            {error.message}
          </p>
        )}
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 cursor-help opacity-50 hover:opacity-100 transition-opacity">
              <History className="h-3 w-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] w-48">
            Tentando reconectar automaticamente. Erros de rede costumam ser temporários.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRetry} 
        disabled={isLoading}
        className="h-8 text-[10px] px-2"
      >
        {isLoading ? <RotateCcw className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
        Tentar agora
      </Button>
    </div>
  );
}
