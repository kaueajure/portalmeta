import React from "react";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  action,
  className,
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5",
        className,
      )}
    >
      <div>
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
};

export const SectionTitle = ({
  title,
  className,
}: {
  title: string;
  className?: string;
}) => (
  <h2
    className={cn(
      "text-[15px] font-semibold text-slate-900 mb-3 tracking-tight",
      className,
    )}
  >
    {title}
  </h2>
);
