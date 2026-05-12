import type { ScanTaskDto } from "@mdcz/shared/serverDtos";
import { useWorkbenchTaskStore } from "@mdcz/shared/stores/workbenchTaskStore";
import type { LocalScanEntry } from "@mdcz/shared/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../client";
import { createWebMaintenanceActionPort, createWebScrapeActionPort } from "./ports";

afterEach(() => {
  vi.restoreAllMocks();
  useWorkbenchTaskStore.getState().reset();
});

describe("web scrape action port", () => {
  it("enables file deletion only for root-relative targets and calls safe server delete", async () => {
    const deleteFile = vi.spyOn(api.scrape, "deleteFile").mockResolvedValue({
      ok: true,
      rootId: "root-1",
      relativePath: "ABC-001.mp4",
    });
    const port = createWebScrapeActionPort();
    const safeTargets = [
      { filePath: "ABC-001.mp4", ref: { rootId: "root-1", relativePath: "ABC-001.mp4" } },
      { filePath: "ABC-001-CD2.mp4", ref: { rootId: "root-1", relativePath: "ABC-001-CD2.mp4" } },
    ];

    expect(port.getDeleteFileAvailability?.([{ filePath: "/absolute/ABC-001.mp4" }])).toBe("hidden");
    expect(port.getDeleteFileAvailability?.(safeTargets)).toBe("enabled");

    await port.deleteFile(safeTargets);

    expect(deleteFile).toHaveBeenNthCalledWith(1, { rootId: "root-1", relativePath: "ABC-001.mp4" });
    expect(deleteFile).toHaveBeenNthCalledWith(2, { rootId: "root-1", relativePath: "ABC-001-CD2.mp4" });
  });

  it("rejects delete calls when any target lacks a root-relative ref", async () => {
    const port = createWebScrapeActionPort();

    await expect(
      port.deleteFile([
        { filePath: "ABC-001.mp4", ref: { rootId: "root-1", relativePath: "ABC-001.mp4" } },
        { filePath: "/absolute/ABC-001-CD2.mp4" },
      ]),
    ).rejects.toThrow("Web 删除文件需要媒体目录引用");
  });
});

const createEntry = (): LocalScanEntry => ({
  fileId: "root-1:ABC-001.mp4",
  rootRef: { rootId: "root-1", relativePath: "ABC-001.mp4" },
  fileInfo: {
    filePath: "ABC-001.mp4",
    fileName: "ABC-001.mp4",
    extension: ".mp4",
    number: "ABC-001",
    isSubtitled: false,
  },
  assets: { sceneImages: [], actorPhotos: [] },
  currentDir: "/media",
});

describe("web maintenance action port", () => {
  it("stores maintenance task id in shared workbench state and reuses it across port instances", async () => {
    const runningTask: ScanTaskDto = {
      id: "maintenance-task-1",
      kind: "maintenance",
      rootId: "root-1",
      rootDisplayName: "Media",
      status: "running",
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-12T00:00:00.000Z",
      startedAt: "2026-05-12T00:00:00.000Z",
      completedAt: null,
      videoCount: 1,
      directoryCount: 0,
      error: null,
      videos: ["ABC-001.mp4"],
    };
    vi.spyOn(api.maintenance, "start").mockResolvedValue(runningTask);
    vi.spyOn(api.maintenance, "preview").mockResolvedValue({
      task: runningTask,
      items: [],
      confirmationToken: "maintenance:maintenance-task-1",
    });
    const pause = vi.spyOn(api.maintenance, "pause").mockResolvedValue({
      ...runningTask,
      status: "paused",
    });

    await createWebMaintenanceActionPort().preview([createEntry()], "refresh_data");
    await createWebMaintenanceActionPort().pause();

    expect(useWorkbenchTaskStore.getState().hydrationState.activeMaintenanceTaskId).toBe("maintenance-task-1");
    expect(pause).toHaveBeenCalledWith({ taskId: "maintenance-task-1" });
  });
});
