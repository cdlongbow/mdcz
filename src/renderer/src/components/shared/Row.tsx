import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const rowVariants = cva("flex transition-colors w-full", {
  variants: {
    variant: {
      metadata: "gap-3 text-sm py-1 items-start",
      form: "items-center justify-between space-y-0 gap-4 px-4 py-3 hover:bg-muted/10",
      dense: "gap-2 text-xs py-0.5 items-center",
    },
  },
  defaultVariants: {
    variant: "metadata",
  },
});

interface RowProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof rowVariants> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  labelWidth?: string;
  labelClassName?: string;
  contentClassName?: string;
}

export function Row({
  variant,
  label,
  description,
  children,
  className,
  labelWidth = "w-16",
  labelClassName,
  contentClassName,
  ...props
}: RowProps) {
  if (variant === "form") {
    return (
      <div className={cn(rowVariants({ variant }), "min-h-12", className)} {...props}>
        <div className="flex-1 space-y-0.5 pr-4 min-w-0">
          <div className={cn("text-sm font-medium text-foreground", labelClassName)}>{label}</div>
          {description && (
            <div className="text-xs text-muted-foreground font-normal leading-relaxed">{description}</div>
          )}
        </div>
        <div className={cn("shrink-0 flex justify-end items-center min-w-0", contentClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cn(rowVariants({ variant }), className)} {...props}>
      {label && (
        <span
          className={cn(
            "text-muted-foreground shrink-0 text-right",
            variant === "metadata" ? labelWidth : "w-auto",
            labelClassName,
          )}
        >
          {label}
        </span>
      )}
      <div className={cn("flex-1 min-w-0", contentClassName)}>
        {children}
        {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
      </div>
    </div>
  );
}
