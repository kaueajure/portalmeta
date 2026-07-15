import React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const variants = {
      primary:
        "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 shadow-sm shadow-blue-600/15 border border-blue-600",
      secondary:
        "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-500 border border-slate-200/70",
      ghost:
        "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-500 border border-transparent",
      danger:
        "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm border border-transparent",
      outline:
        "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-950 focus-visible:ring-slate-500 shadow-sm",
      subtle:
        "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-500 border border-slate-200/70",
    };

    const sizes = {
      xs: "h-6 px-2.5 text-[11px] rounded-md gap-1.5",
      sm: "h-7 px-3 text-xs rounded-md gap-1.5",
      md: "h-8 px-3.5 text-[13px] rounded-md gap-2",
      lg: "h-10 px-5 text-sm rounded-lg gap-2",
      icon: "h-8 w-8 p-0 rounded-md",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
