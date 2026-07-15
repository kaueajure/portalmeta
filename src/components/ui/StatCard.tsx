import React from "react";
import { cn } from "../../lib/utils";
import { Card } from "./Card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export const StatCard = ({
  title,
  value,
  icon,
  trend,
  className,
}: StatCardProps) => {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-slate-500 mb-1 tracking-wide">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {value}
            </h3>
            {trend && (
              <span
                className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center",
                  trend.isPositive
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-red-700 bg-red-50",
                )}
              >
                {trend.isPositive ? "+" : "-"}
                {trend.value}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
