import { SlidersHorizontal } from "lucide-react";

interface AdvancedSettingsFooterContentProps {
  hasActiveFilters: boolean;
  isAdvancedVisible: boolean;
  onToggleShowAdvanced: () => void;
}

export function AdvancedSettingsFooterContent({
  hasActiveFilters,
  isAdvancedVisible,
  onToggleShowAdvanced,
}: AdvancedSettingsFooterContentProps) {
  if (hasActiveFilters) {
    return null;
  }

  const actionLabel = isAdvancedVisible ? "隐藏高级设置" : "显示高级设置";
  return (
    <div className="flex justify-end pt-2">
      <button
        type="button"
        onClick={onToggleShowAdvanced}
        className="inline-flex items-center gap-2 rounded-[var(--radius-quiet-capsule)] bg-surface-low px-3.5 py-2 text-sm text-foreground outline-none transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}
