import { parse } from "node:path";
import { configurationSchema } from "@main/services/config";
import { FileOrganizer } from "@main/services/scraper/FileOrganizer";
import { Website } from "@shared/enums";
import type { CrawlerData, FileInfo } from "@shared/types";
import { describe, expect, it } from "vitest";

const createFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => {
  return {
    filePath: "/input/ABC-123.mp4",
    fileName: "ABC-123",
    extension: ".mp4",
    number: "ABC-123",
    isSubtitled: false,
    ...overrides,
  };
};

const createCrawlerData = (overrides: Partial<CrawlerData> = {}): CrawlerData => {
  return {
    title: "Sample Title",
    number: "ABC-123",
    actors: [],
    genres: [],
    sample_images: [],
    website: Website.DMM,
    ...overrides,
  };
};

describe("FileOrganizer naming settings", () => {
  it("applies subtitle/umr/leak/uncensored markers to the rendered number", () => {
    const config = configurationSchema.parse({
      paths: {
        mediaPath: "/media",
        successOutputFolder: "output",
      },
      naming: {
        folderTemplate: "{number}",
        fileTemplate: "{number}",
        cnwordStyle: "-SUB",
        umrStyle: "-UMR",
        leakStyle: "-LEAK",
        uncensoredStyle: "-UNC",
        censoredStyle: "-CEN",
      },
    });

    const organizer = new FileOrganizer();
    const plan = organizer.plan(
      createFileInfo({
        isSubtitled: true,
      }),
      createCrawlerData({
        number: "FC2-123456",
        genres: ["流出", "破解"],
      }),
      config,
    );

    const renderedFileName = parse(plan.targetVideoPath).name;
    expect(renderedFileName).toBe("FC2-123456-SUB-UMR-LEAK-UNC");
  });

  it("applies release date formatting and max length limits", () => {
    const config = configurationSchema.parse({
      paths: {
        mediaPath: "/media",
        successOutputFolder: "output",
      },
      naming: {
        folderTemplate: "{date}-{number}",
        fileTemplate: "{date}-{number}",
        releaseRule: "YYYY.MM.DD",
        folderNameMax: 12,
        fileNameMax: 12,
      },
    });

    const organizer = new FileOrganizer();
    const plan = organizer.plan(
      createFileInfo(),
      createCrawlerData({
        number: "ABCD-1234",
        release_date: "2024-1-2",
      }),
      config,
    );

    const folderName = parse(plan.outputDir).base;
    const renderedFileName = parse(plan.targetVideoPath).name;
    expect(folderName.startsWith("2024.01.02")).toBe(true);
    expect(renderedFileName.startsWith("2024.01.02")).toBe(true);
    expect(folderName.length).toBeLessThanOrEqual(12);
    expect(renderedFileName.length).toBeLessThanOrEqual(12);
  });
});
