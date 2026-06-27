import { SUPPORTED_MEDIA_EXTENSIONS_WITH_DOT } from "./mediaExtensions";

const VIDEO_EXTENSION_SET = new Set(SUPPORTED_MEDIA_EXTENSIONS_WITH_DOT.map((extension) => extension.toLowerCase()));
const FC2_SPECIAL_FEATURE_HINTS = ["花絮", "おまけ", "特典", "gift"];

export type VideoClassification = "video" | "non-video";

export const isSupportedVideoExtension = (extension: string): boolean => {
  const normalized = extension.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return VIDEO_EXTENSION_SET.has(normalized.startsWith(".") ? normalized : `.${normalized}`);
};

const fileExtension = (fileName: string): string => {
  const baseName = fileName.replace(/^.*[/\\]/u, "");
  const dotIndex = baseName.lastIndexOf(".");
  return dotIndex > 0 ? baseName.slice(dotIndex) : "";
};

const fileStem = (fileName: string): string => {
  const baseName = fileName.replace(/^.*[/\\]/u, "");
  const dotIndex = baseName.lastIndexOf(".");
  return (dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName).normalize("NFC");
};

export const isVideoFileName = (fileName: string): boolean => isSupportedVideoExtension(fileExtension(fileName));

export const isGeneratedVideoSidecarFileName = (fileName: string): boolean => {
  const rawName = fileStem(fileName);
  const normalizedName = rawName.toLowerCase();
  if (normalizedName === "trailer" || /(?:^|[-_.\s])trailer$/iu.test(normalizedName)) {
    return true;
  }

  if (!/(?:^|[-_.\s])FC2(?:[-_.\s]?PPV)?[-_.\s]?\d{5,}/iu.test(rawName)) {
    return false;
  }

  return FC2_SPECIAL_FEATURE_HINTS.some((hint) => normalizedName.includes(hint));
};

export const isPrimaryVideoFileName = (fileName: string): boolean =>
  isVideoFileName(fileName) && !isGeneratedVideoSidecarFileName(fileName);

export const classifyFileName = (fileName: string): VideoClassification =>
  isVideoFileName(fileName) ? "video" : "non-video";
