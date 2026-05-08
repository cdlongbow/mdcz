import { describe, expect, it } from "vitest";
import { taskRealtimeEventSchema } from "./serverDtos";

const createdAt = "2026-05-06T00:00:00.000Z";

const scrapeResult = {
  id: "result-1",
  taskId: "task-1",
  rootId: "root-1",
  rootDisplayName: "Media",
  relativePath: "ABC-001.mp4",
  fileName: "ABC-001.mp4",
  status: "processing" as const,
  error: null,
  crawlerData: null,
  nfoRelativePath: null,
  outputRelativePath: null,
  manualUrl: null,
  uncensoredAmbiguous: false,
  createdAt,
  updatedAt: createdAt,
};

const maintenancePreviewItem = {
  id: "preview-1",
  taskId: "task-1",
  presetId: "refresh_data" as const,
  rootId: "root-1",
  rootDisplayName: "Media",
  relativePath: "ABC-001.mp4",
  fileName: "ABC-001.mp4",
  status: "ready" as const,
  error: null,
  fieldDiffs: [],
  unchangedFieldDiffs: [],
  pathDiff: null,
  proposedCrawlerData: null,
  createdAt,
  updatedAt: createdAt,
};

const maintenanceApplyItem = {
  id: "apply-1",
  taskId: "task-1",
  previewId: "preview-1",
  rootId: "root-1",
  relativePath: "ABC-001.mp4",
  presetId: "refresh_data" as const,
  status: "success" as const,
  error: null,
  appliedAt: createdAt,
};

describe("taskRealtimeEventSchema", () => {
  it("accepts every current realtime task-event variant", () => {
    const events = [
      {
        id: "log-1",
        taskId: "runtime",
        createdAt,
        kind: "log",
        log: {
          id: "log-1",
          taskId: "runtime",
          type: "info",
          message: "ready",
          createdAt,
          source: "runtime",
          level: "INFO",
        },
      },
      {
        id: "progress-1",
        taskId: "task-1",
        createdAt,
        kind: "task-progress",
        taskKind: "scrape",
        current: 1,
        total: 2,
        message: "ABC-001.mp4",
      },
      {
        id: "stage-1",
        taskId: "task-1",
        createdAt,
        kind: "scrape-stage",
        stage: "download",
        message: "下载封面",
        relativePath: "ABC-001.mp4",
      },
      {
        id: "result-1",
        taskId: "task-1",
        createdAt,
        kind: "scrape-result",
        result: scrapeResult,
      },
      {
        id: "failed-1",
        taskId: "task-1",
        createdAt,
        kind: "task-failed",
        message: "任务失败",
        error: "boom",
      },
      {
        id: "preview-1",
        taskId: "task-1",
        createdAt,
        kind: "maintenance-preview-item",
        item: maintenancePreviewItem,
      },
      {
        id: "apply-1",
        taskId: "task-1",
        createdAt,
        kind: "maintenance-apply-item",
        item: maintenanceApplyItem,
      },
    ];

    expect(events.map((event) => taskRealtimeEventSchema.parse(event).kind)).toEqual([
      "log",
      "task-progress",
      "scrape-stage",
      "scrape-result",
      "task-failed",
      "maintenance-preview-item",
      "maintenance-apply-item",
    ]);
  });

  it("rejects removed draft realtime event variants", () => {
    expect(() =>
      taskRealtimeEventSchema.parse({
        id: "old-progress",
        taskId: "task-1",
        createdAt,
        kind: "progress",
        current: 1,
        total: 2,
      }),
    ).toThrow();
    expect(() =>
      taskRealtimeEventSchema.parse({
        id: "old-run-state",
        taskId: "task-1",
        createdAt,
        kind: "run-state",
        status: "running",
      }),
    ).toThrow();
    expect(() =>
      taskRealtimeEventSchema.parse({
        id: "old-maintenance",
        taskId: "task-1",
        createdAt,
        kind: "maintenance-item-result",
        relativePath: "ABC-001.mp4",
        status: "success",
      }),
    ).toThrow();
  });
});
