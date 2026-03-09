import { normalizeText } from "./normalization";

const MANAGED_MOVIE_TAG_PREFIX = "mdcz:";

const MANAGED_MOVIE_TAG_KEYS = ["content_type", "publisher"] as const;

type ManagedMovieTagKey = (typeof MANAGED_MOVIE_TAG_KEYS)[number];

const buildManagedMovieTag = (key: ManagedMovieTagKey, value: string | undefined): string | undefined => {
  const normalized = normalizeText(value);
  return normalized ? `${MANAGED_MOVIE_TAG_PREFIX}${key}:${normalized}` : undefined;
};

const parseManagedMovieTag = (tag: string): { key: ManagedMovieTagKey; value: string } | null => {
  if (!tag.startsWith(MANAGED_MOVIE_TAG_PREFIX)) {
    return null;
  }

  const payload = tag.slice(MANAGED_MOVIE_TAG_PREFIX.length);
  const separatorIndex = payload.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = payload.slice(0, separatorIndex);
  const value = normalizeText(payload.slice(separatorIndex + 1));
  if (!MANAGED_MOVIE_TAG_KEYS.includes(key as ManagedMovieTagKey) || !value) {
    return null;
  }

  return {
    key: key as ManagedMovieTagKey,
    value,
  };
};

export const buildManagedMovieTags = (input: { contentType?: string; publisher?: string }): string[] => {
  return [
    buildManagedMovieTag("content_type", input.contentType),
    buildManagedMovieTag("publisher", input.publisher),
  ].filter((entry): entry is string => Boolean(entry));
};

export const parseManagedMovieTags = (
  tags: string[],
): {
  content_type?: string;
  publisher?: string;
} => {
  const parsed: {
    content_type?: string;
    publisher?: string;
  } = {};

  for (const tag of tags) {
    const entry = parseManagedMovieTag(tag);
    if (!entry) {
      continue;
    }

    if (entry.key === "content_type") {
      parsed.content_type = parsed.content_type ?? entry.value;
      continue;
    }

    if (entry.key === "publisher") {
      parsed.publisher = parsed.publisher ?? entry.value;
    }
  }

  return parsed;
};
