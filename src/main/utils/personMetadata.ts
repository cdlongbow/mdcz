import { normalizeActorName, toUniqueActorNames } from "@main/utils/actor";
import type { ActorProfile } from "@shared/types";
import { normalizeText } from "./normalization";

const ALIASES_PREFIX = "别名：";

const normalizeOverview = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  return normalized || undefined;
};

const buildAliasesLine = (profile: Pick<ActorProfile, "name" | "aliases">): string | undefined => {
  const aliases = toUniqueActorNames(profile.aliases ?? [], (value) => normalizeText(value) || undefined).filter(
    (alias) => normalizeActorName(alias) !== normalizeActorName(profile.name),
  );

  return aliases.length > 0 ? `${ALIASES_PREFIX}${aliases.join(" / ")}` : undefined;
};

export const stripManagedPersonOverview = (overview: string | undefined): string | undefined => {
  const normalizedOverview = normalizeOverview(overview);
  if (!normalizedOverview) {
    return undefined;
  }

  const lines = normalizedOverview.split("\n");
  let endIndex = lines.length;
  while (endIndex > 0 && lines[endIndex - 1] === "") {
    endIndex--;
  }

  if (endIndex === 0 || !lines[endIndex - 1]?.startsWith(ALIASES_PREFIX)) {
    return normalizedOverview;
  }

  endIndex--;
  while (endIndex > 0 && lines[endIndex - 1] === "") {
    endIndex--;
  }

  const strippedOverview = lines.slice(0, endIndex).join("\n").trim();
  return strippedOverview || undefined;
};

export const buildPersonOverview = (
  overview: string | undefined,
  profile: Pick<ActorProfile, "name" | "aliases">,
): string | undefined => {
  const normalizedOverview = normalizeOverview(overview);
  const aliasesLine = buildAliasesLine(profile);

  if (!normalizedOverview) {
    return aliasesLine;
  }

  if (!aliasesLine) {
    return normalizedOverview;
  }

  return `${normalizedOverview}\n\n${aliasesLine}`;
};
