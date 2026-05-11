import type { WebTaskUpdateDto } from "@mdcz/shared";
import {
  applyTaskRealtimeEvent,
  applyWebTaskUpdate,
  createTaskHydrationState,
  maintenancePreviewDtoToPreviewItem,
} from "@mdcz/shared";
import { useMaintenanceExecutionStore } from "@mdcz/shared/stores/maintenanceExecutionStore";
import { useMaintenancePreviewStore } from "@mdcz/shared/stores/maintenancePreviewStore";
import { useScrapeStore } from "@mdcz/shared/stores/scrapeStore";
import { beforeEach, describe, expect, it } from "vitest";
import { __workbenchTestHooks } from "./workbench";

describe("web workbench route contracts", () => {
  beforeEach(() => {
    useScrapeStore.getState().reset();
    useMaintenanceExecutionStore.getState().reset();
    useMaintenancePreviewStore.getState().reset();
  });

  it("keeps uncensored ambiguous flags when projecting scrape result DTOs", () => {
    const result = __workbenchTestHooks.dtoToScrapeResult({
      id: "result-1",
      taskId: "task-1",
      rootId: "root-1",
      rootDisplayName: "Media",
      relativePath: "ABP-999-U.mp4",
      fileName: "ABP-999-U.mp4",
      status: "success",
      error: null,
      crawlerData: null,
      nfoRelativePath: "ABP-999-U.nfo",
      outputRelativePath: "JAV_output/ABP-999/ABP-999-U.mp4",
      manualUrl: null,
      uncensoredAmbiguous: true,
      createdAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    });

    expect(result.uncensoredAmbiguous).toBe(true);
    expect(result.nfoPath).toBe("ABP-999-U.nfo");
    expect(result.fileId).toBe("root-1:ABP-999-U.mp4");
    expect(result.fileInfo.filePath).toBe("ABP-999-U.mp4");
  });

  it("builds mounted refs for failed scrape retry targets", () => {
    const failed = __workbenchTestHooks.dtoToScrapeResult({
      id: "result-1",
      taskId: "task-1",
      rootId: "root-1",
      rootDisplayName: "Media",
      relativePath: "nested/ABC-001.mp4",
      fileName: "ABC-001.mp4",
      status: "failed",
      error: "boom",
      crawlerData: null,
      nfoRelativePath: null,
      outputRelativePath: null,
      manualUrl: null,
      uncensoredAmbiguous: false,
      createdAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    });

    expect(__workbenchTestHooks.scrapeResultsToRetryTargets([failed])).toEqual([
      {
        filePath: "nested/ABC-001.mp4",
        ref: { rootId: "root-1", relativePath: "nested/ABC-001.mp4" },
      },
    ]);
  });

  it("treats a running scrape without an active task id as uncontrollable", () => {
    expect(__workbenchTestHooks.canControlScrapeTask({ isScraping: true, activeTaskId: "" })).toBe(false);
    expect(__workbenchTestHooks.canControlScrapeTask({ isScraping: true, activeTaskId: "task-1" })).toBe(true);
    expect(__workbenchTestHooks.canControlScrapeTask({ isScraping: false, activeTaskId: "" })).toBe(true);
  });

  it("shows setup immediately when scrape state has no controllable task", () => {
    expect(
      __workbenchTestHooks.shouldShowWorkbenchSetup({
        baseShowSetup: false,
        workbenchMode: "scrape",
        isScraping: true,
        activeTaskId: "",
      }),
    ).toBe(true);
    expect(
      __workbenchTestHooks.shouldShowWorkbenchSetup({
        baseShowSetup: false,
        workbenchMode: "scrape",
        isScraping: true,
        activeTaskId: "task-1",
      }),
    ).toBe(false);
    expect(
      __workbenchTestHooks.shouldShowWorkbenchSetup({
        baseShowSetup: false,
        workbenchMode: "maintenance",
        isScraping: true,
        activeTaskId: "",
      }),
    ).toBe(false);
  });

  it("accepts completed task events carrying ambiguous uncensored items", () => {
    const payload: WebTaskUpdateDto = {
      kind: "event",
      event: {
        id: "event-1",
        taskId: "task-1",
        type: "completed",
        message: "done",
        createdAt: "2026-05-03T00:00:00.000Z",
      },
      ambiguousUncensoredItems: [
        {
          id: "result-1",
          ref: { rootId: "root-1", relativePath: "ABP-999-U.mp4" },
          fileId: "root-1:ABP-999-U.mp4",
          fileName: "ABP-999-U.mp4",
          number: "ABP-999",
          title: "Runtime UC Title",
          nfoRelativePath: "ABP-999-U.nfo",
        },
      ],
    };

    expect(payload.ambiguousUncensoredItems?.[0]?.ref).toEqual({
      rootId: "root-1",
      relativePath: "ABP-999-U.mp4",
    });

    const state = applyWebTaskUpdate(payload, createTaskHydrationState());
    expect(state).toMatchObject({
      uncensoredTaskId: "task-1",
      shouldOpenUncensoredDialog: true,
    });
    expect(state.ambiguousUncensoredItems).toHaveLength(1);
  });

  it("maps maintenance preview DTOs into desktop-compatible preview items", () => {
    const item = maintenancePreviewDtoToPreviewItem({
      id: "preview-1",
      taskId: "task-1",
      presetId: "refresh_data",
      rootId: "root-1",
      rootDisplayName: "Media",
      relativePath: "ABC-001.mp4",
      fileName: "ABC-001.mp4",
      status: "ready",
      error: null,
      fieldDiffs: [
        {
          kind: "value",
          field: "title",
          label: "标题",
          oldValue: "Old",
          newValue: "New",
          changed: true,
        },
      ],
      unchangedFieldDiffs: [],
      pathDiff: {
        changed: false,
        currentDir: "/media",
        currentVideoPath: "/media/ABC-001.mp4",
        fileId: "root-1:ABC-001.mp4",
        targetDir: "/media",
        targetVideoPath: "/media/ABC-001.mp4",
      },
      proposedCrawlerData: null,
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });

    expect(item).toMatchObject({
      fileId: "root-1:ABC-001.mp4",
      previewId: "preview-1",
      taskId: "task-1",
      status: "ready",
      fieldDiffs: [{ field: "title", changed: true }],
    });
  });

  it("accepts realtime scrape result events", () => {
    const state = applyTaskRealtimeEvent(
      {
        id: "realtime-1",
        taskId: "task-1",
        createdAt: "2026-05-06T00:00:00.000Z",
        kind: "scrape-result",
        result: {
          id: "result-1",
          taskId: "task-1",
          rootId: "root-1",
          rootDisplayName: "Media",
          relativePath: "ABC-001.mp4",
          fileName: "ABC-001.mp4",
          status: "processing",
          error: null,
          crawlerData: null,
          nfoRelativePath: null,
          outputRelativePath: null,
          manualUrl: null,
          uncensoredAmbiguous: false,
          createdAt: "2026-05-06T00:00:00.000Z",
          updatedAt: "2026-05-06T00:00:00.000Z",
        },
      },
      createTaskHydrationState(),
    );

    expect(state.activeScrapeTaskId).toBe("task-1");
  });

  it("routes realtime progress by task kind", () => {
    applyTaskRealtimeEvent(
      {
        id: "progress-1",
        taskId: "scrape-task",
        createdAt: "2026-05-06T00:00:00.000Z",
        kind: "task-progress",
        taskKind: "scrape",
        current: 2,
        total: 4,
      },
      createTaskHydrationState(),
    );

    expect(useScrapeStore.getState()).toMatchObject({ current: 2, total: 4, progress: 50 });
    expect(useMaintenanceExecutionStore.getState()).toMatchObject({ progressCurrent: 0, progressTotal: 0 });

    applyTaskRealtimeEvent(
      {
        id: "progress-2",
        taskId: "maintenance-task",
        createdAt: "2026-05-06T00:00:00.000Z",
        kind: "task-progress",
        taskKind: "maintenance",
        current: 1,
        total: 5,
      },
      createTaskHydrationState(),
    );

    expect(useScrapeStore.getState()).toMatchObject({ current: 2, total: 4 });
    expect(useMaintenanceExecutionStore.getState()).toMatchObject({
      progressCurrent: 1,
      progressTotal: 5,
      progressValue: 20,
    });
  });

  it("applies realtime maintenance preview and apply items by stable file identity", () => {
    applyTaskRealtimeEvent(
      {
        id: "preview-event-1",
        taskId: "maintenance-task",
        createdAt: "2026-05-06T00:00:00.000Z",
        kind: "maintenance-preview-item",
        item: {
          id: "preview-1",
          taskId: "maintenance-task",
          presetId: "refresh_data",
          rootId: "root-1",
          rootDisplayName: "Media",
          relativePath: "ABC-001.mp4",
          fileName: "ABC-001.mp4",
          status: "ready",
          error: null,
          fieldDiffs: [],
          unchangedFieldDiffs: [],
          pathDiff: null,
          proposedCrawlerData: null,
          createdAt: "2026-05-06T00:00:00.000Z",
          updatedAt: "2026-05-06T00:00:00.000Z",
        },
      },
      createTaskHydrationState(),
    );

    expect(useMaintenancePreviewStore.getState().previewResults["root-1:ABC-001.mp4"]).toMatchObject({
      fileId: "root-1:ABC-001.mp4",
      previewId: "preview-1",
      status: "ready",
    });

    applyTaskRealtimeEvent(
      {
        id: "apply-event-1",
        taskId: "maintenance-task",
        createdAt: "2026-05-06T00:00:00.000Z",
        kind: "maintenance-apply-item",
        item: {
          id: "apply-1",
          taskId: "maintenance-task",
          previewId: "preview-1",
          rootId: "root-1",
          relativePath: "ABC-001.mp4",
          presetId: "refresh_data",
          status: "success",
          error: null,
          appliedAt: "2026-05-06T00:00:00.000Z",
        },
      },
      createTaskHydrationState(),
    );

    expect(useMaintenanceExecutionStore.getState().itemResults["root-1:ABC-001.mp4"]).toMatchObject({
      fileId: "root-1:ABC-001.mp4",
      status: "success",
    });
  });
});
