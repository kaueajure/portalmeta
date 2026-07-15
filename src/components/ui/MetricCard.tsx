import React from "react";
import { cn } from "../../lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "./Card";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?:
    | "blue"
    | "emerald"
    | "amber"
    | "red"
    | "slate"
    | "indigo"
    | "orange"
    | "purple";
  loading?: boolean;
  className?: string;
  compact?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  trend,
  color = "blue",
  loading,
  className,
  compact,
}) => {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200/60",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    amber: "bg-amber-50 text-amber-700 border-amber-200/60",
    red: "bg-red-50 text-red-700 border-red-200/60",
    slate: "bg-slate-50 text-slate-700 border-slate-200/60",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
    orange: "bg-orange-50 text-orange-700 border-orange-200/60",
    purple: "bg-purple-50 text-purple-700 border-purple-200/60",
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className={cn(compact ? "p-3.5" : "p-5")}>
          <div className="flex justify-between items-start mb-3">
            <div
              className={cn(
                "rounded-lg bg-slate-100",
                compact ? "w-8 h-8" : "w-10 h-10",
              )}
            ></div>
            <div className="w-12 h-3 bg-slate-100 rounded"></div>
          </div>
          <div className="w-16 h-6 bg-slate-100 rounded mb-1.5"></div>
          <div className="w-24 h-3 bg-slate-100 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("transition-all hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]", className)}>
      <CardContent
        className={cn(
          "flex flex-col justify-between h-full",
          compact ? "p-3.5" : "p-5 pt-4",
        )}
      >
        <div className="mb-3 flex items-start justify-between">
          <div
            className={cn(
              "flex items-center justify-center rounded-md border",
              colors[color],
              compact ? "w-7 h-7 *:w-3.5 *:h-3.5" : "w-10 h-10 *:w-5 *:h-5",
            )}
          >
            {icon}
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                trend.positive
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200/60"
                  : "text-red-700 bg-red-50 border-red-200/60",
              )}
            >
              {trend.positive ? (
                <TrendingUp size={10} />
              ) : (
                <TrendingDown size={10} />
              )}
              {trend.value}
            </div>
          )}
        </div>
        <div className="mt-1">
          <div
            className={cn(
              "font-semibold tracking-tight leading-none text-slate-950",
              compact ? "text-lg" : "text-2xl",
            )}
          >
            {value}
          </div>
          <div className="mt-1 text-[12px] font-medium text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
};
