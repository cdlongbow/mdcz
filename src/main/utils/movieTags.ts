import { classifyMovie } from "@main/utils/movieClassification";
import { buildManagedMovieTags } from "@main/utils/movieMetadata";
import { normalizeNfoLocalState, uncensoredChoiceToTag } from "@main/utils/nfoLocalState";
import { resolveFileInfoSubtitleTag } from "@main/utils/subtitles";
import type { CrawlerData, FileInfo, NfoLocalState } from "@shared/types";

export interface PosterBadgeDefinition {
  id: "subtitle" | "umr" | "leak" | "uncensored";
  label: string;
  colorStart: string;
  colorEnd: string;
  accentColor: string;
}

const POSTER_BADGE_DEFINITIONS: Array<PosterBadgeDefinition & { sourceTags: string[] }> = [
  {
    id: "subtitle",
    label: "中字",
    colorStart: "#F04A3A",
    colorEnd: "#B91C1C",
    accentColor: "#FFD5D0",
    sourceTags: ["中文字幕", "字幕", "中字"],
  },
  {
    id: "umr",
    label: "破解",
    colorStart: "#E77A0C",
    colorEnd: "#B45309",
    accentColor: "#FDE5C2",
    sourceTags: ["破解"],
  },
  {
    id: "leak",
    label: "流出",
    colorStart: "#2B6CB0",
    colorEnd: "#1E3A5F",
    accentColor: "#D6E8FF",
    sourceTags: ["流出"],
  },
  {
    id: "uncensored",
    label: "无码",
    colorStart: "#505B67",
    colorEnd: "#1F2937",
    accentColor: "#E5E7EB",
    sourceTags: ["无码"],
  },
];

export const buildMovieTags = (
  data: CrawlerData,
  fileInfo: FileInfo | undefined,
  localState: NfoLocalState | undefined,
): string[] => {
  const classificationTags: string[] = [];
  const normalizedLocalState = normalizeNfoLocalState(localState);
  const localChoiceTag = uncensoredChoiceToTag(normalizedLocalState?.uncensoredChoice);
  if (localChoiceTag) {
    classificationTags.push(localChoiceTag);
  }

  if (fileInfo) {
    if (!localChoiceTag) {
      const classification = classifyMovie(fileInfo, data, normalizedLocalState);
      if (classification.umr) {
        classificationTags.push("破解");
      } else if (classification.leak) {
        classificationTags.push("流出");
      } else if (classification.uncensored) {
        classificationTags.push("无码");
      }
    }

    const subtitleTag = resolveFileInfoSubtitleTag(fileInfo);
    if (subtitleTag) {
      classificationTags.push(subtitleTag);
    }
  }

  return Array.from(
    new Set([
      ...classificationTags,
      ...(normalizedLocalState?.tags ?? []),
      ...buildManagedMovieTags({
        contentType: data.content_type,
      }),
    ]),
  );
};

export const resolvePosterBadgeDefinitions = (
  data: CrawlerData,
  fileInfo: FileInfo | undefined,
  localState: NfoLocalState | undefined,
): PosterBadgeDefinition[] => {
  const tags = new Set(buildMovieTags(data, fileInfo, localState));

  return POSTER_BADGE_DEFINITIONS.filter((definition) => definition.sourceTags.some((tag) => tags.has(tag))).map(
    ({ sourceTags: _sourceTags, ...definition }) => definition,
  );
};
