import React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, disabled, indeterminate = false, ...props }, ref) => {
    const control = (
      <span className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center" data-compact-touch="true">
        <input
          {...props}
          ref={ref}
          type="checkbox"
          disabled={disabled}
          aria-checked={indeterminate ? "mixed" : props.checked}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex h-4.5 w-4.5 items-center justify-center rounded border border-slate-400 bg-white text-white shadow-sm transition-colors",
            "peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600/35 peer-focus-visible:ring-offset-2",
            "peer-disabled:cursor-not-allowed peer-disabled:border-slate-300 peer-disabled:bg-slate-100 peer-disabled:text-slate-400",
            indeterminate && "border-blue-600 bg-blue-600",
            className,
          )}
        >
          {indeterminate ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
        </span>
      </span>
    );

    if (!label && !description) return control;

    return (
      <label className={cn("flex cursor-pointer items-start gap-1.5 text-xs text-slate-700", disabled && "cursor-not-allowed opacity-60")}>
        {control}
        <span className="pt-2">
          {label && <span className="block font-medium">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
        </span>
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
