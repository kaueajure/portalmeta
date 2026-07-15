import React from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?:
    | "blue"
    | "emerald"
    | "amber"
    | "red"
    | "slate"
    | "indigo"
    | "orange"
    | "purple";
  className?: string;
}

export const Badge = ({
  children,
  variant = "slate",
  className,
  ...props
}: BadgeProps) => {
  const variants = {
    blue: "bg-blue-50 text-blue-700 border-blue-200/70",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    amber: "bg-amber-50 text-amber-800 border-amber-200/70",
    red: "bg-red-50 text-red-700 border-red-200/70",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
    orange: "bg-orange-50 text-orange-700 border-orange-200/70",
    purple: "bg-violet-50 text-violet-700 border-violet-200/70",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold tracking-normal border",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
