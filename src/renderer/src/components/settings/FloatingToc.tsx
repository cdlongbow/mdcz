import { cn } from "@/lib/utils";
import { useToc } from "./TocContext";
import { useScrollSpy } from "./useScrollSpy";

interface FloatingTocProps {
  className?: string;
}

export function FloatingToc({ className }: FloatingTocProps) {
  const { sections, activeId, setActiveId, scrollContainerRef } = useToc();

  useScrollSpy({
    sections,
    scrollContainer: scrollContainerRef.current,
    onActiveChange: setActiveId,
  });

  if (sections.length === 0) return null;

  const handleClick = (id: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-toc-id="${id}"]`);
    if (!el) return;
    const containerTop = container.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    container.scrollBy({ top: elTop - containerTop - 24, behavior: "smooth" });
  };

  return (
    <nav
      aria-label="Settings sections"
      className={cn("hidden xl:block sticky top-24 ml-8 w-44 shrink-0 self-start", className)}
    >
      <ul className="space-y-3 text-sm">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => handleClick(section.id)}
                className={cn(
                  "block w-full text-left transition-colors outline-none",
                  "focus-visible:text-foreground",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
