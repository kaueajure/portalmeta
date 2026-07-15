import React from "react";
import { cn } from "../../lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export const ErrorState = ({
  title = "Ocorreu um erro",
  message,
  onRetry,
  className,
  compact,
}: ErrorStateProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-lg border border-rose-200/80 bg-rose-50/60",
        compact ? "p-4" : "p-8",
        className,
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600",
          compact ? "w-8 h-8" : "w-10 h-10",
        )}
      >
        <AlertTriangle size={compact ? 16 : 20} />
      </div>
      <h3
        className={cn(
          "font-semibold text-slate-950",
          compact ? "text-[13px] mb-0.5" : "text-sm mb-1",
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "text-slate-500 max-w-sm",
          compact ? "text-[11px]" : "text-[13px]",
        )}
      >
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size={compact ? "xs" : "sm"}
          onClick={onRetry}
          className="mt-4 gap-1.5"
        >
          <RefreshCw size={12} />
          Tentar novamente
        </Button>
      )}
    </div>
  );
};
