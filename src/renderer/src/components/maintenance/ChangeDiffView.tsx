import type { ActorProfile, FieldDiff } from "@shared/types";
import { useShallow } from "zustand/react/shallow";
import { ImageOptionCard } from "@/components/ImageOptionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  getDefaultMaintenanceFieldSelection,
  hasMaintenanceFieldValue,
  resolveMaintenanceDiffImageOption,
} from "@/lib/maintenance";
import { cn } from "@/lib/utils";
import { useMaintenanceStore } from "@/store/maintenanceStore";

const IMAGE_FIELDS = new Set(["thumb_url", "poster_url", "fanart_url"]);

const toJoinedProfileNames = (profiles: ActorProfile[]) => profiles.map((profile) => profile.name).join(", ");
const uniqueNonEmptyStrings = (values: Array<string | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

const formatValue = (value: unknown): string => {
  if (!hasMaintenanceFieldValue(value)) {
    return "(空)";
  }
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      return (value as string[]).join(", ");
    }
    if (
      value.every(
        (item) => item && typeof item === "object" && "name" in item && typeof (item as ActorProfile).name === "string",
      )
    ) {
      return toJoinedProfileNames(value as ActorProfile[]);
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

function DiffOption({
  title,
  value,
  selected,
  disabled,
  onClick,
}: {
  title: string;
  value: unknown;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-32 rounded-xl border-2 p-4 text-left transition-all",
        selected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/20",
        disabled && "cursor-not-allowed opacity-50 hover:border-transparent",
      )}
    >
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {formatValue(value)}
      </div>
    </button>
  );
}

export default function ChangeDiffView({
  entryId,
  diffs,
  unchangedDiffs = [],
}: {
  entryId: string;
  diffs: FieldDiff[];
  unchangedDiffs?: FieldDiff[];
}) {
  const { entry, entrySelections, preview, setFieldSelection } = useMaintenanceStore(
    useShallow((state) => ({
      entry: state.entries.find((candidate) => candidate.id === entryId),
      entrySelections: state.fieldSelections[entryId],
      preview: state.previewResults[entryId],
      setFieldSelection: state.setFieldSelection,
    })),
  );

  const renderDiffCard = (diff: FieldDiff, mode: "changed" | "unchanged") => {
    const oldImage = resolveMaintenanceDiffImageOption(entry, preview, diff, "old");
    const newImage = resolveMaintenanceDiffImageOption(entry, preview, diff, "new");
    const oldImageSrc = oldImage.src;
    const newImageSrc = newImage.src;
    const oldImageFallbacks = oldImage.fallbackSrcs;
    const newImageFallbacks = newImage.fallbackSrcs;
    const hasOldValue = IMAGE_FIELDS.has(diff.field)
      ? hasMaintenanceFieldValue(diff.oldValue) || oldImageSrc.length > 0 || oldImageFallbacks.length > 0
      : hasMaintenanceFieldValue(diff.oldValue);
    const hasNewValue = IMAGE_FIELDS.has(diff.field)
      ? hasMaintenanceFieldValue(diff.newValue) || newImageSrc.length > 0 || newImageFallbacks.length > 0
      : hasMaintenanceFieldValue(diff.newValue);
    const selectedSide = entrySelections?.[diff.field] ?? getDefaultMaintenanceFieldSelection(diff);
    const isImageField = IMAGE_FIELDS.has(diff.field);
    const currentImageCandidates = uniqueNonEmptyStrings([
      oldImageSrc,
      ...oldImageFallbacks,
      newImageSrc,
      ...newImageFallbacks,
    ]);
    const currentImageSrc = currentImageCandidates[0] ?? "";
    const currentImageFallbacks = currentImageCandidates.slice(1);

    return (
      <Card key={`${entryId}-${mode}-${diff.field}`} className="rounded-xl border shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">{diff.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {mode === "changed" ? (
            <div className="grid md:grid-cols-2">
              {isImageField ? (
                <>
                  <ImageOptionCard
                    src={oldImageSrc}
                    fallbackSrcs={oldImageFallbacks}
                    label="旧 (NFO)"
                    stacked
                    selected={selectedSide === "old"}
                    empty={!hasOldValue}
                    emptyText="旧值为空"
                    onClick={
                      hasOldValue && hasNewValue ? () => setFieldSelection(entryId, diff.field, "old") : undefined
                    }
                  />
                  <ImageOptionCard
                    src={newImageSrc}
                    fallbackSrcs={newImageFallbacks}
                    label="新 (网络)"
                    stacked
                    selected={selectedSide === "new"}
                    empty={!hasNewValue}
                    emptyText="新值为空"
                    onClick={
                      hasOldValue && hasNewValue ? () => setFieldSelection(entryId, diff.field, "new") : undefined
                    }
                  />
                </>
              ) : (
                <>
                  <DiffOption
                    title="旧 (NFO)"
                    value={diff.oldValue}
                    selected={selectedSide === "old"}
                    disabled={!hasOldValue}
                    onClick={() => setFieldSelection(entryId, diff.field, "old")}
                  />
                  <DiffOption
                    title="新 (网络)"
                    value={diff.newValue}
                    selected={selectedSide === "new"}
                    disabled={!hasNewValue}
                    onClick={() => setFieldSelection(entryId, diff.field, "new")}
                  />
                </>
              )}
            </div>
          ) : isImageField ? (
            <ImageOptionCard
              src={currentImageSrc}
              fallbackSrcs={currentImageFallbacks}
              label="当前值"
              stacked
              empty={!hasOldValue && !hasNewValue}
              emptyText="当前值为空"
            />
          ) : (
            <div className="rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap wrap-break-word">
              {formatValue(diff.oldValue)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (diffs.length === 0 && unchangedDiffs.length === 0) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">
          预览后将在此显示字段差异。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {diffs.length > 0 && <div className="space-y-4">{diffs.map((diff) => renderDiffCard(diff, "changed"))}</div>}

      {unchangedDiffs.length > 0 && (
        <section className="space-y-4">
          <div className="px-1 text-xs font-medium text-muted-foreground">未变更字段</div>
          {unchangedDiffs.map((diff) => renderDiffCard(diff, "unchanged"))}
        </section>
      )}
    </div>
  );
}
