import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/Collapsible";
import { cn } from "@/lib/utils";

interface SubsectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function Subsection({ title, description, defaultOpen = true, className, children }: SubsectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("py-2", className)}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md">
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-numeric text-base font-bold tracking-tight text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-none data-[state=open]:animate-none">
        <div className="mt-2 space-y-1 pl-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
