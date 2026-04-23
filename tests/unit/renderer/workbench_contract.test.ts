import type { ConfigOutput } from "@renderer/client/types";
import {
  filterMediaCandidates,
  mergeMediaCandidates,
  resolveMediaCandidateScanPlan,
} from "@renderer/components/workbench/mediaCandidateScan";
import type { MediaCandidate } from "@shared/types";
import { describe, expect, it } from "vitest";

const rootDir = process.platform === "win32" ? "D:\\media" : "/media";
const successDir = process.platform === "win32" ? "D:\\media\\JAV_output" : "/media/JAV_output";
const failedDir = process.platform === "win32" ? "D:\\media\\failed" : "/media/failed";
const softlinkDir = process.platform === "win32" ? "D:\\softlink" : "/softlink";

const createConfig = (overrides?: Partial<ConfigOutput>): ConfigOutput =>
  ({
    paths: {
      mediaPath: rootDir,
      successOutputFolder: "JAV_output",
      failedOutputFolder: "failed",
      softlinkPath: softlinkDir,
      outputSummaryPath: "",
    },
    behavior: {
      scrapeSoftlinkPath: true,
    },
    ...overrides,
  }) as ConfigOutput;

const createCandidate = (path: string): MediaCandidate => ({
  path,
  name: path.split(/[\\/]+/u).at(-1) ?? path,
  size: 1,
  lastModified: null,
  extension: ".mp4",
  relativePath: path,
  relativeDirectory: "",
});

describe("workbench setup contract", () => {
  it("plans normal scrape scans from configured paths and excludes output folders", () => {
    const plan = resolveMediaCandidateScanPlan("scrape", rootDir, successDir, createConfig());

    expect(plan.excludeDirPath).toBe(successDir);
    expect(plan.filterDirPaths).toEqual([successDir, failedDir]);
    expect(plan.extraScanDirs).toEqual([softlinkDir]);
  });

  it("filters output-folder candidates and dedupes merged scan roots", () => {
    const keptVideo = createCandidate(
      process.platform === "win32" ? "D:\\media\\library\\ABC-123.mp4" : "/media/library/ABC-123.mp4",
    );
    const failedVideo = createCandidate(
      process.platform === "win32" ? "D:\\media\\failed\\XYZ-999.mp4" : "/media/failed/XYZ-999.mp4",
    );
    const successVideo = createCandidate(
      process.platform === "win32" ? "D:\\media\\JAV_output\\DONE-001.mp4" : "/media/JAV_output/DONE-001.mp4",
    );
    const duplicate = createCandidate(
      process.platform === "win32" ? "D:\\MEDIA\\library\\ABC-123.mp4" : keptVideo.path,
    );
    const softlinkVideo = createCandidate(
      process.platform === "win32" ? "D:\\softlink\\SOFT-001.mp4" : "/softlink/SOFT-001.mp4",
    );

    expect(filterMediaCandidates([keptVideo, failedVideo, successVideo], [successDir, failedDir])).toEqual([keptVideo]);
    expect(mergeMediaCandidates([keptVideo], [duplicate, softlinkVideo])).toEqual([keptVideo, softlinkVideo]);
    expect(
      mergeMediaCandidates([createCandidate("D:\\media\\ABC-123.mp4")], [createCandidate("d:/MEDIA/abc-123.mp4")]),
    ).toEqual([createCandidate("D:\\media\\ABC-123.mp4")]);
  });
});
