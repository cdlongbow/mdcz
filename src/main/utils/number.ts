import { basename, extname } from "node:path";

import type { FileInfo } from "@shared/types";

const SUBTITLE_PATTERN = /(?:^|[-_.\s])(UC|C)(?:$|[-_.\s])/iu;
const RESOLUTION_PATTERNS = [/\b8K\b/iu, /\b4K\b/iu, /\b2160P\b/iu, /\b1080P\b/iu, /\b720P\b/iu];
const PART_PATTERN = /(?:^|[-_.\s])(?:CD|PART|EP)[-_\s]?(\d{1,2})(?:$|[-_.\s])/iu;

const SHORT_TOKEN_PATTERNS = [
  "4K",
  "4KS",
  "8K",
  "HD",
  "HEVC",
  "H264",
  "H265",
  "X264",
  "X265",
  "AAC",
  "DVD",
  "FULL",
] as const;

const normalizeRawName = (rawName: string, escapeStrings: string[] = []): string => {
  let normalized = rawName.normalize("NFC").toUpperCase();

  for (const token of escapeStrings) {
    if (!token.trim()) {
      continue;
    }
    normalized = normalized.replaceAll(token.toUpperCase(), "");
  }

  for (const token of SHORT_TOKEN_PATTERNS) {
    normalized = normalized.replace(new RegExp(`[-_.\\s\\[]${token}[-_.\\s\\]]`, "giu"), "-");
  }

  normalized = normalized
    .replace(/FC2[-_ ]?PPV/giu, "FC2-")
    .replace(/GACHIPPV/giu, "GACHI")
    .replace(/--+/gu, "-")
    .replace(/\d{4}[-_.]\d{1,2}[-_.]\d{1,2}/gu, "")
    .replace(/[-[]\d{2}[-_.]\d{2}[-_.]\d{2}\]?/gu, "")
    .replace(PART_PATTERN, "")
    .replace(/[-_.\s][A-Z0-9]\.$/gu, "")
    .replace(/[-_.\s]+/gu, "-")
    .replace(/^[-_.\s]+|[-_.\s]+$/gu, "");

  return normalized;
};

const normalizeNumber = (value: string): string => {
  return value
    .replace(/FC-/u, "FC2-")
    .replace(/--+/gu, "-")
    .replace(/^[-_.\s]+|[-_.\s]+$/gu, "");
};

export const extractNumber = (fileName: string, escapeStrings: string[] = []): string => {
  const normalized = normalizeRawName(fileName, escapeStrings);

  const orderedPatterns: RegExp[] = [
    /(FC2-\d{5,})/iu,
    /(FC2\d{5,})/iu,
    /(HEYZO-\d{3,})/iu,
    /(HEYZO\d{3,})/iu,
    /(TH101-\d{3,}-\d{5,})/iu,
    /(T28-?\d{3,})/iu,
    /(S2M[BD]*-\d{3,})/iu,
    /(MCB3D[BD]*-\d{2,})/iu,
    /(KIN8(?:TENGOKU)?-?\d{3,})/iu,
    /(CW3D2D?BD-?\d{2,})/iu,
    /(MMR-?[A-Z]{2,}-?\d+[A-Z]*)/iu,
    /(XXX-AV-\d{4,})/iu,
    /(MKY-[A-Z]+-\d{3,})/iu,
    /([A-Z]{2,})00(\d{3})/iu,
    /(\d{2,}[A-Z]{2,}-\d{2,}[A-Z]?)/iu,
    /([A-Z]{2,}-\d{2,}[A-Z]?)/iu,
    /([A-Z]+-[A-Z]\d+)/iu,
    /(\d{2,}[-_]\d{2,})/iu,
    /(\d{3,}-[A-Z]{3,})/iu,
    /(?:^|[^A-Z])(N\d{4})(?:[^A-Z]|$)/iu,
    /H_\d{3,}([A-Z]{2,})(\d{2,})/iu,
    /([A-Z]{3,}).*?(\d{2,})/iu,
    /([A-Z]{2,}).*?(\d{3,})/iu,
  ];

  for (const pattern of orderedPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    if (pattern.source === "([A-Z]{2,})00(\\d{3})") {
      return normalizeNumber(`${match[1]}-${match[2]}`);
    }

    if (pattern.source === "H_\\d{3,}([A-Z]{2,})(\\d{2,})") {
      return normalizeNumber(`${match[1]}-${match[2]}`);
    }

    if (pattern.source === "([A-Z]{3,}).*?(\\d{2,})" || pattern.source === "([A-Z]{2,}).*?(\\d{3,})") {
      return normalizeNumber(`${match[1]}-${match[2]}`);
    }

    return normalizeNumber(match[1] ?? match[0]);
  }

  return normalizeNumber(normalized);
};

export const parseFileInfo = (filePath: string, escapeStrings: string[] = []): FileInfo => {
  const extension = extname(filePath).toLowerCase();
  const stem = basename(filePath, extension);
  const normalizedStem = stem.normalize("NFC");
  const normalizedUpper = normalizedStem.toUpperCase();

  const subtitleMatch = normalizedUpper.match(SUBTITLE_PATTERN);
  const resolutionMatch = RESOLUTION_PATTERNS.map((pattern) => normalizedUpper.match(pattern)).find(Boolean);
  const partMatch = normalizedUpper.match(PART_PATTERN);
  const number = extractNumber(`${normalizedStem}.`, escapeStrings);

  return {
    filePath,
    fileName: normalizedStem,
    extension,
    number,
    isSubtitled: Boolean(subtitleMatch),
    resolution: resolutionMatch?.[0],
    partNumber: partMatch ? Number.parseInt(partMatch[1], 10) : undefined,
  };
};
