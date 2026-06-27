import { normalizeText, uniqueStrings } from "@mdcz/runtime/shared";
import { Website } from "@mdcz/shared/enums";
import type { CrawlerData } from "@mdcz/shared/types";
import type { CheerioAPI } from "cheerio";

import { BaseCrawler } from "../base/BaseCrawler";
import type { Context, CrawlerInput, SearchPageResolution } from "../base/types";
import type { CrawlerRegistration } from "../registration";
import { toAbsoluteUrl } from "./helpers";
import { type JsonLdRecord, readFirstJsonLdRecord } from "./jsonLd";

const H0930_BASE_URL = "https://www.h0930.com";
const H0930_MOVIE_ID_PATTERN = /^[a-z]+\d+$/iu;

interface H0930Context extends Context {
  movieId: string;
  canonicalNumber: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const normalized = normalizeText(String(value));
  return normalized || undefined;
};

const readRecordString = (record: Record<string, unknown> | null | undefined, key: string): string | undefined =>
  record ? toStringValue(record[key]) : undefined;

const readFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const normalized = toStringValue(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
};

const parseIsoDate = (value: string | undefined): string | undefined => {
  const matched = value?.match(/^(\d{4}-\d{2}-\d{2})/u);
  return matched?.[1];
};

const parseIsoDurationToSeconds = (value: unknown): number | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const matched = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/iu);
  if (!matched) {
    return undefined;
  }

  const hours = Number.parseInt(matched[1] ?? "0", 10);
  const minutes = Number.parseInt(matched[2] ?? "0", 10);
  const seconds = Number.parseInt(matched[3] ?? "0", 10);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : undefined;
};

const normalizeMovieId = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const matched = url.pathname.match(/^\/moviepages\/([^/]+)\/index\.html$/iu);
    if (matched?.[1] && H0930_MOVIE_ID_PATTERN.test(matched[1])) {
      return matched[1].toLowerCase();
    }
  } catch {}

  const normalized = trimmed.toLowerCase().replace(/[\s_.]+/gu, "-");
  const prefixedMatch = normalized.match(/^h0930-?([a-z]+\d+)$/iu);
  const movieId = prefixedMatch?.[1] ?? normalized;

  return H0930_MOVIE_ID_PATTERN.test(movieId) ? movieId.toLowerCase() : null;
};

const toCanonicalNumber = (movieId: string): string => `H0930-${movieId.toUpperCase()}`;

const toJsonLdActors = (value: unknown): string[] => {
  if (typeof value === "string") {
    return uniqueStrings([value]);
  }

  if (Array.isArray(value)) {
    return uniqueStrings(
      value.map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        return isRecord(entry) ? toStringValue(entry.name) : undefined;
      }),
    );
  }

  return isRecord(value) ? uniqueStrings([toStringValue(value.name)]) : [];
};

const toJsonLdImage = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }

  return undefined;
};

const readNestedRecord = (record: JsonLdRecord | null, key: string): Record<string, unknown> | null => {
  const value = record?.[key];
  return isRecord(value) ? value : null;
};

const readReleasedDate = (record: JsonLdRecord | null): string | undefined => {
  const releasedEvent = readNestedRecord(record, "releasedEvent");
  const video = readNestedRecord(record, "video");

  return parseIsoDate(
    readFirstString(record?.dateCreated, releasedEvent?.startDate, video?.uploadDate, video?.dateCreated),
  );
};

const decodeH0930Html = (bytes: Uint8Array): string => {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!/charset\s*=\s*euc-jp/iu.test(utf8)) {
    return utf8;
  }

  try {
    return new TextDecoder("euc-jp").decode(bytes);
  } catch {
    return utf8;
  }
};

const extractMetaContent = ($: CheerioAPI, selector: string): string | undefined => {
  return normalizeText($(selector).first().attr("content")) || undefined;
};

const extractDocumentTitle = ($: CheerioAPI): string | undefined => {
  const title =
    normalizeText($(".moviePlay_title h1").first().text()) ||
    extractMetaContent($, "meta[property='og:title']") ||
    normalizeText($("title").first().text());

  return title
    ?.replace(/\s*-\s*(?:H0930|h0930|.+?0930)\s*$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
};

const isPublicH0930Url = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "www.h0930.com" || parsed.hostname === "h0930.com" || parsed.hostname === "smovie.h0930.com"
    );
  } catch {
    return false;
  }
};

const isPublicSceneImageUrl = (url: string, movieId: string): boolean => {
  if (!isPublicH0930Url(url) || url.includes("members.")) {
    return false;
  }

  return new RegExp(`/moviepages/${movieId}/images/g_[bs]\\d+\\.(?:jpe?g|png|webp)$`, "iu").test(url);
};

const extractSceneImages = ($: CheerioAPI, detailUrl: string, movieId: string): string[] => {
  const html = $.html();
  const quotedUrls = Array.from(
    html.matchAll(
      /["']((?:https?:)?\/\/(?:www\.)?h0930\.com\/moviepages\/[^"']+\/images\/g_[bs]\d+\.(?:jpe?g|png|webp))["']/giu,
    ),
  ).map((match) => match[1]);

  const domUrls = $("img[src], a[href]")
    .toArray()
    .flatMap((element) => [$(element).attr("src"), $(element).attr("href")]);

  return uniqueStrings(
    [...quotedUrls, ...domUrls]
      .map((value) => toAbsoluteUrl(detailUrl, value))
      .filter((url): url is string => typeof url === "string" && isPublicSceneImageUrl(url, movieId)),
  );
};

const extractTrailerUrl = ($: CheerioAPI, record: JsonLdRecord | null, detailUrl: string): string | undefined => {
  const video = readNestedRecord(record, "video");
  return toAbsoluteUrl(
    detailUrl,
    readFirstString(video?.contentUrl, $("video source").first().attr("src"), $("video").first().attr("src")),
  );
};

export class H0930Crawler extends BaseCrawler {
  site(): Website {
    return Website.H0930;
  }

  protected override newContext(input: CrawlerInput): H0930Context {
    const context = super.newContext(input) as H0930Context;
    const movieId =
      normalizeMovieId(input.options?.detailUrl ?? "") ?? normalizeMovieId(input.number) ?? input.number.toLowerCase();
    context.movieId = movieId;
    context.canonicalNumber = toCanonicalNumber(movieId);
    return context;
  }

  protected async generateSearchUrl(context: H0930Context): Promise<string | null> {
    return new URL(`/moviepages/${context.movieId}/index.html`, H0930_BASE_URL).href;
  }

  protected override async fetch(url: string, context: H0930Context): Promise<string> {
    const bytes = await this.gateway.fetchContent(url, this.createFetchOptions(context));
    return decodeH0930Html(bytes);
  }

  protected async parseSearchPage(
    _context: H0930Context,
    _$: CheerioAPI,
    searchUrl: string,
  ): Promise<SearchPageResolution> {
    return this.reuseSearchDocument(searchUrl);
  }

  protected classifyDetailFailure(
    context: H0930Context,
    _detailHtml: string,
    _$: CheerioAPI,
    _detailUrl: string,
  ): string | null {
    return `Detail URL not found for ${context.canonicalNumber}`;
  }

  protected async parseDetailPage(
    context: H0930Context,
    $: CheerioAPI,
    detailUrl: string,
  ): Promise<CrawlerData | null> {
    const jsonLd = readFirstJsonLdRecord($);
    const video = readNestedRecord(jsonLd, "video");
    const title = readFirstString(jsonLd?.name, video?.name, extractDocumentTitle($));

    if (!title) {
      return null;
    }

    const coverUrl = toAbsoluteUrl(
      detailUrl,
      readFirstString(
        toJsonLdImage(jsonLd?.image),
        video?.thumbnail,
        video?.thumbnailUrl,
        $("video").first().attr("poster"),
        extractMetaContent($, "meta[property='og:image']"),
      ),
    );
    const trailerUrl = extractTrailerUrl($, jsonLd, detailUrl);
    const actors = uniqueStrings([...toJsonLdActors(jsonLd?.actor), ...toJsonLdActors(video?.actor)]);
    const metaKeywords = extractMetaContent($, "meta[name='keywords']")
      ?.split(/[、,，]/u)
      .map((value) => normalizeText(value))
      .filter((value) => value.length > 0);
    const provider = readFirstString(video?.provider, readRecordString(jsonLd, "provider"), "H0930");

    return {
      title,
      number: context.canonicalNumber,
      actors,
      genres: uniqueStrings(metaKeywords ?? []),
      studio: provider,
      director: undefined,
      publisher: provider,
      series: undefined,
      plot: readFirstString(jsonLd?.description, video?.description, extractMetaContent($, "meta[name='description']")),
      release_date: readReleasedDate(jsonLd),
      rating: undefined,
      durationSeconds: parseIsoDurationToSeconds(readFirstString(jsonLd?.duration, video?.duration)),
      thumb_url: coverUrl,
      poster_url: coverUrl,
      fanart_url: undefined,
      scene_images: extractSceneImages($, detailUrl, context.movieId),
      trailer_url: trailerUrl && isPublicH0930Url(trailerUrl) ? trailerUrl : undefined,
      website: Website.H0930,
    };
  }
}

export const crawlerRegistration: CrawlerRegistration = {
  site: Website.H0930,
  crawler: H0930Crawler,
};
