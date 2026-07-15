import React from "react";
import { cn } from "../../lib/utils";

export const Card = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn("flex flex-col space-y-1 p-4 pb-3 lg:p-5 lg:pb-3", className)}>
    {children}
  </div>
);

export const CardTitle = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <h3
    className={cn(
      "text-base font-semibold text-slate-950 tracking-tight",
      className,
    )}
  >
    {children}
  </h3>
);

export const CardDescription = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <p className={cn("text-[13px] text-slate-500 font-medium leading-relaxed", className)}>
    {children}
  </p>
);

export const CardContent = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => <div className={cn("p-4 lg:p-5 pt-0", className)}>{children}</div>;

export const CardFooter = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn("flex items-center p-4 lg:p-5 pt-0", className)}>
    {children}
  </div>
);
