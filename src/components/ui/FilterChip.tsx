import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
  key?: string | number;
}

export const FilterChip = ({
  label,
  value,
  onRemove,
  className,
}: FilterChipProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 group",
        className,
      )}
    >
      <span className="text-slate-400 font-medium">{label}:</span>
      <span className="text-slate-700">{value}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
};
