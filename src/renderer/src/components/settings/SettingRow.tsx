import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  control: ReactNode;
  status?: ReactNode;
  error?: string | null;
  className?: string;
}

export function SettingRow({ label, description, htmlFor, control, status, error, className }: SettingRowProps) {
  return (
    <div className={cn("flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between md:gap-8", className)}>
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block font-numeric text-sm font-bold tracking-tight text-foreground">
          {label}
        </label>
        {description && <p className="mt-1 max-w-prose text-xs text-muted-foreground">{description}</p>}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="min-w-0">{control}</div>
        {status && (
          <div aria-live="polite" className="min-w-[4.5rem] text-xs text-muted-foreground">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
