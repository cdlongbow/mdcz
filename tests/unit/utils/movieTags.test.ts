import { buildMovieTags, resolvePosterBadgeDefinitions } from "@main/utils/movieTags";
import { Website } from "@shared/enums";
import type { CrawlerData, FileInfo, NfoLocalState } from "@shared/types";
import { describe, expect, it } from "vitest";

const createCrawlerData = (overrides: Partial<CrawlerData> = {}): CrawlerData => ({
  title: "Sample",
  number: "ABC-123",
  actors: [],
  genres: [],
  scene_images: [],
  website: Website.DMM,
  ...overrides,
});

const createFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  filePath: "/tmp/ABC-123.mp4",
  fileName: "ABC-123.mp4",
  extension: ".mp4",
  number: "ABC-123",
  isSubtitled: false,
  ...overrides,
});

describe("movieTags", () => {
  it("builds the same managed tags used by NFO generation", () => {
    const tags = buildMovieTags(
      createCrawlerData({
        title: "高清无码 破解版",
      }),
      createFileInfo({
        isSubtitled: true,
        subtitleTag: "中文字幕",
      }),
      undefined,
    );

    expect(tags).toEqual(["破解", "中文字幕"]);
  });

  it("resolves poster badge definitions in filename marker order", () => {
    const badges = resolvePosterBadgeDefinitions(
      createCrawlerData({
        title: "Sample",
      }),
      createFileInfo({
        isSubtitled: true,
      }),
      {
        uncensoredChoice: "leak",
      },
    );

    expect(badges.map((badge) => badge.label)).toEqual(["中字", "流出"]);
  });

  it("maps local subtitle and uncensored tags into supported badge labels", () => {
    const localState: NfoLocalState = {
      tags: ["中文字幕", "自定义标签"],
      uncensoredChoice: "umr",
    };

    const badges = resolvePosterBadgeDefinitions(createCrawlerData(), undefined, localState);

    expect(badges.map((badge) => badge.label)).toEqual(["中字", "破解"]);
  });
});
