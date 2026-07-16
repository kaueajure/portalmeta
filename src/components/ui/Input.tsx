import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  inputSize?: "sm" | "md" | "lg";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, label, error, hint, inputSize = "md", ...props },
    ref,
  ) => {
    const sizeClasses = {
      sm: "h-9 px-2.5 py-1 text-xs",
      md: "h-10 px-3 py-1.5 text-[13px]",
      lg: "h-11 px-3.5 py-2 text-sm",
    };

    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="text-xs font-semibold text-slate-700">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex w-full rounded-md border border-slate-300 bg-white ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 transition-all",
            "shadow-[0_1px_1px_rgba(15,23,42,0.02)] hover:border-slate-400",
            error &&
              "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500",
            sizeClasses[inputSize],
            className,
          )}
          ref={ref}
          {...props}
        />
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
        {error && (
          <p className="text-xs font-medium text-red-700">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
