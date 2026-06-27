import { buildMovieAssetFileNames, isMovieNfoBaseName } from "@mdcz/shared/assetNaming";
import type { DetailViewItem } from "./types";

const getPathBaseName = (path: string | undefined): string => {
  const trimmed = path?.trim();
  if (!trimmed) {
    return "";
  }

  const normalizedPath = trimmed.replace(/[\\/]+$/u, "");
  const separatorIndex = Math.max(normalizedPath.lastIndexOf("/"), normalizedPath.lastIndexOf("\\"));
  const fileName = separatorIndex >= 0 ? normalizedPath.slice(separatorIndex + 1) : normalizedPath;
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
};

const resolveMovieBaseName = (item: DetailViewItem | null | undefined): string => {
  const videoBaseName = getPathBaseName(item?.path);
  if (videoBaseName) {
    return videoBaseName;
  }

  const nfoBaseName = getPathBaseName(item?.nfoPath);
  if (nfoBaseName && !isMovieNfoBaseName(nfoBaseName)) {
    return nfoBaseName;
  }

  return item?.number?.trim() ?? "";
};

const buildSiblingPath = (filePath: string, fileName: string): string => {
  const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const separator = filePath.lastIndexOf("\\") > filePath.lastIndexOf("/") ? "\\" : "/";
  if (slash < 0) {
    return fileName;
  }

  return `${filePath.slice(0, slash)}${separator}${fileName}`;
};

const getImageBaseDir = (filePath: string | undefined, outputPath: string | undefined): string => {
  if (outputPath) {
    return outputPath;
  }

  if (!filePath) {
    return "";
  }

  const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (slash < 0) {
    return "";
  }

  return filePath.slice(0, slash) || filePath[0] || "";
};

const buildLocalImageCandidate = (
  filePath: string | undefined,
  outputPath: string | undefined,
  fileName: string,
): string => {
  if (outputPath) {
    const separator = outputPath.lastIndexOf("\\") > outputPath.lastIndexOf("/") ? "\\" : "/";
    return `${outputPath}${separator}${fileName}`;
  }

  if (filePath) {
    return buildSiblingPath(filePath, fileName);
  }

  return "";
};

const normalizeImageSourcePath = (rawPath: string): string => {
  const value = rawPath.trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (parsed.pathname.endsWith("/api/v1/files/image") || parsed.pathname.endsWith("/api/v1/crop/image")) {
      const path = parsed.searchParams.get("path");
      if (path) {
        return path;
      }
    }

    if (parsed.protocol === "file:" || parsed.protocol === "local-file:") {
      if (parsed.host) {
        return `//${parsed.host}${decodeURIComponent(parsed.pathname)}`;
      }

      const pathname = decodeURIComponent(parsed.pathname);
      if (/^\/[A-Za-z]:\//u.test(pathname)) {
        return pathname.slice(1);
      }
      return pathname;
    }
  } catch {
    // Plain local path.
  }

  return value;
};

const isSupportedRemoteImageScheme = (value: string): boolean =>
  value.startsWith("http://") ||
  value.startsWith("https://") ||
  value.startsWith("data:") ||
  value.startsWith("blob:") ||
  value.startsWith("local-file://") ||
  value.startsWith("file://");

const hasExplicitUnsupportedScheme = (value: string): boolean => {
  if (/^[a-z]:[\\/]/iu.test(value)) {
    return false;
  }

  if (isSupportedRemoteImageScheme(value)) {
    return false;
  }

  return /^[a-z][a-z\d+.-]*:/iu.test(value);
};

const isAbsoluteLocalPath = (value: string): boolean =>
  /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("/") || value.startsWith("\\\\") || value.startsWith("//");

const joinRelativePath = (baseDir: string, relativePath: string): string => {
  const separator = baseDir.lastIndexOf("\\") > baseDir.lastIndexOf("/") ? "\\" : "/";
  const normalizedBase = baseDir.replace(/[\\/]+$/u, "");
  const normalizedRelative = relativePath.replace(/^[\\/]+/u, "");

  if (!normalizedBase) {
    return normalizedRelative;
  }

  if (!normalizedRelative) {
    return normalizedBase;
  }

  return `${normalizedBase}${separator}${normalizedRelative}`;
};

const resolveImagePath = (rawPath: string | undefined, baseDir?: string): string => {
  if (!rawPath) {
    return "";
  }

  const path = normalizeImageSourcePath(rawPath);
  if (!path) {
    return "";
  }

  if (isSupportedRemoteImageScheme(path) || isAbsoluteLocalPath(path) || hasExplicitUnsupportedScheme(path)) {
    return path;
  }

  return baseDir ? joinRelativePath(baseDir, path) : path;
};

interface ImageSourceCandidatesInput {
  remotePath?: string;
  filePath?: string;
  outputPath?: string;
  fileName: string;
}

const buildImageSourceCandidates = (input: ImageSourceCandidatesInput): { primary: string; fallback: string } => {
  const fallback = buildLocalImageCandidate(input.filePath, input.outputPath, input.fileName);
  const baseDir = getImageBaseDir(input.filePath, input.outputPath);
  const primary = resolveImagePath(input.remotePath, baseDir) || fallback;

  return {
    primary,
    fallback,
  };
};

const dedupeCandidates = (candidates: string[]): string[] =>
  candidates
    .map((candidate) => candidate.trim())
    .filter((candidate, index, items) => candidate && items.indexOf(candidate) === index);

export interface DetailArtworkCandidates {
  poster: string[];
  thumb: string[];
}

export const buildDetailArtworkCandidates = (item: DetailViewItem | null | undefined): DetailArtworkCandidates => {
  if (!item) {
    return { poster: [], thumb: [] };
  }

  const assetBasePath = item.path ?? item.nfoPath;
  const movieAssetFileNames = buildMovieAssetFileNames(resolveMovieBaseName(item), "followVideo");
  const posterCandidates = buildImageSourceCandidates({
    remotePath: item.posterUrl,
    filePath: assetBasePath,
    outputPath: item.outputPath,
    fileName: "poster.jpg",
  });
  const thumbCandidates = buildImageSourceCandidates({
    remotePath: item.thumbUrl ?? item.fanartUrl,
    filePath: assetBasePath,
    outputPath: item.outputPath,
    fileName: "thumb.jpg",
  });

  return {
    poster: dedupeCandidates([
      posterCandidates.primary,
      buildLocalImageCandidate(assetBasePath, item.outputPath, movieAssetFileNames.poster),
      posterCandidates.fallback,
    ]),
    thumb: dedupeCandidates([
      thumbCandidates.primary,
      buildLocalImageCandidate(assetBasePath, item.outputPath, movieAssetFileNames.thumb),
      thumbCandidates.fallback,
    ]),
  };
};
