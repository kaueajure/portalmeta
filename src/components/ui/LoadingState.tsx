import React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

export const LoadingState = ({
  message = "Carregando dados...",
  className,
  compact,
}: LoadingStateProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-lg border border-slate-200/70 bg-white",
        compact ? "p-4" : "p-10",
        className,
      )}
    >
      <Loader2
        className={cn(
          "animate-spin text-slate-900",
          compact ? "w-5 h-5 mb-2" : "w-6 h-6 mb-3",
        )}
      />
      <p
        className={cn(
          "text-slate-500 font-medium",
          compact ? "text-[11px]" : "text-[13px]",
        )}
      >
        {message}
      </p>
    </div>
  );
};
