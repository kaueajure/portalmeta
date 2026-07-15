import React from "react";
import { cn } from "../../lib/utils";

interface PageShellProps {
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  flush?: boolean;
  fixedHeight?: boolean;
}

export function PageShell({
  actions,
  tabs,
  children,
  className,
  contentClassName,
  flush = false,
  fixedHeight = true,
}: PageShellProps) {
  return (
    <section
      className={cn(
        "w-full overflow-hidden border border-slate-200/80 bg-white",
        "rounded-lg shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        fixedHeight && "h-full min-h-0 flex flex-col",
        className,
      )}
    >
      {(tabs || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/70 bg-white px-4 sm:px-5">
          {tabs && <div className="min-w-0 flex-1">{tabs}</div>}
          {actions && (
            <div className="ml-auto flex flex-wrap items-center gap-2 py-2.5">
              {actions}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "min-h-0",
          fixedHeight && "flex-1 overflow-y-auto custom-scrollbar",
          flush ? "p-0" : "p-4",
          "bg-white",
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
