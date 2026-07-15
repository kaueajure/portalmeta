import React from "react";
import { cn } from "../../lib/utils";

interface PageShellProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  flush?: boolean;
  fixedHeight?: boolean;
}

export function PageShell({
  title,
  subtitle,
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
      {(title || subtitle || actions) && (
        <header className="shrink-0 flex flex-col gap-4 border-b border-slate-200/80 bg-white px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
          <div>
            {title && (
              <h1 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </header>
      )}

      {tabs && (
        <div className="shrink-0 border-b border-slate-200/70 bg-white px-5">
          {tabs}
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
