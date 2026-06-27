import { cn } from "@mdcz/ui";
import { type ReactNode, useMemo, useState } from "react";

export interface NaturalAspectImageFrameProps {
  alt: string;
  className?: string;
  defaultAspectRatio?: number;
  empty?: boolean;
  emptyNode?: ReactNode;
  height?: number | null;
  imageClassName?: string;
  loading?: boolean;
  loadingNode?: ReactNode;
  onError?: () => void;
  onLoadDimensions?: (dimensions: { height: number; width: number }) => void;
  src?: string | null;
  width?: number | null;
}

const toAspectRatio = (width: number | null | undefined, height: number | null | undefined): string | undefined => {
  if (!width || !height || width <= 0 || height <= 0) {
    return undefined;
  }

  return `${width} / ${height}`;
};

export function NaturalAspectImageFrame({
  alt,
  className,
  defaultAspectRatio = 16 / 9,
  empty = false,
  emptyNode,
  height,
  imageClassName,
  loading = false,
  loadingNode,
  onError,
  onLoadDimensions,
  src,
  width,
}: NaturalAspectImageFrameProps) {
  const fallbackAspectRatio = `${defaultAspectRatio} / 1`;
  const providedAspectRatio = useMemo(() => toAspectRatio(width, height), [height, width]);
  const sourceKey = src ?? "";
  const [loadedAspectRatio, setLoadedAspectRatio] = useState<{ aspectRatio: string; sourceKey: string } | null>(null);
  const aspectRatio =
    loadedAspectRatio?.sourceKey === sourceKey
      ? loadedAspectRatio.aspectRatio
      : (providedAspectRatio ?? fallbackAspectRatio);
  const shouldShowImage = Boolean(src) && !empty && !loading;

  return (
    <div
      className={cn("relative flex w-full shrink-0 items-center justify-center overflow-hidden bg-muted/20", className)}
      style={{ aspectRatio }}
    >
      {loading ? (
        (loadingNode ?? <div className="h-full w-full animate-pulse bg-muted/40" />)
      ) : shouldShowImage ? (
        <img
          src={src ?? ""}
          alt={alt}
          className={cn("block h-full w-full object-cover object-center", imageClassName)}
          onError={onError}
          onLoad={(event) => {
            const { naturalHeight, naturalWidth } = event.currentTarget;
            const nextAspectRatio = toAspectRatio(naturalWidth, naturalHeight);
            if (nextAspectRatio) {
              setLoadedAspectRatio({ aspectRatio: nextAspectRatio, sourceKey });
            }
            if (naturalWidth > 0 && naturalHeight > 0) {
              onLoadDimensions?.({ height: naturalHeight, width: naturalWidth });
            }
          }}
        />
      ) : (
        emptyNode
      )}
    </div>
  );
}
