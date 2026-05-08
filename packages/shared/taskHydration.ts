import { maintenancePreviewDtoToPreviewItem, scrapeResultDtoToScrapeResult } from "./dtoAdapters";
import type {
  AmbiguousUncensoredItemDto,
  MaintenanceApplyLogDto,
  MaintenancePreviewResponse,
  ScanTaskDto,
  ScrapeResultListResponse,
  TaskRealtimeEventDto,
  WebTaskUpdateDto,
} from "./serverDtos";
import { useMaintenanceExecutionStore } from "./stores/maintenanceExecutionStore";
import { useMaintenancePreviewStore } from "./stores/maintenancePreviewStore";
import { applyMaintenanceExecutionItemResult, applyMaintenancePreviewResult } from "./stores/maintenanceSession";
import { useScrapeStore } from "./stores/scrapeStore";
import type { MaintenancePreviewItem } from "./types";

export interface TaskHydrationState {
  activeScrapeTaskId: string;
  activeMaintenanceTaskId: string;
  latestScrapeStage: { taskId: string; stage: string; message: string; relativePath?: string } | null;
  latestTaskFailure: { taskId: string; message: string; error?: string | null } | null;
  uncensoredTaskId: string;
  ambiguousUncensoredItems: AmbiguousUncensoredItemDto[];
  shouldOpenUncensoredDialog: boolean;
}

export const createTaskHydrationState = (): TaskHydrationState => ({
  activeScrapeTaskId: "",
  activeMaintenanceTaskId: "",
  latestScrapeStage: null,
  latestTaskFailure: null,
  uncensoredTaskId: "",
  ambiguousUncensoredItems: [],
  shouldOpenUncensoredDialog: false,
});

const taskStatusToScrapeStatus = (
  status: ScanTaskDto["status"],
): ReturnType<typeof useScrapeStore.getState>["scrapeStatus"] => {
  if (status === "running" || status === "queued") return "running";
  if (status === "paused") return "paused";
  if (status === "stopping") return "stopping";
  return "idle";
};

const taskStatusToMaintenanceStatus = (
  status: ScanTaskDto["status"],
): ReturnType<typeof useMaintenanceExecutionStore.getState>["executionStatus"] => {
  if (status === "running" || status === "queued") return "previewing";
  if (status === "paused") return "paused";
  if (status === "stopping") return "stopping";
  return "idle";
};

export const hydrateScrapeResults = (response: ScrapeResultListResponse): void => {
  const store = useScrapeStore.getState();
  store.clearResults();
  for (const result of response.results.map(scrapeResultDtoToScrapeResult)) {
    store.addResult(result);
  }
};

export const hydrateMaintenancePreview = (response: MaintenancePreviewResponse): MaintenancePreviewItem[] => {
  const items = response.items.map(maintenancePreviewDtoToPreviewItem);
  applyMaintenancePreviewResult({ items });
  return items;
};

const maintenanceApplyLogDtoToItemResult = (item: MaintenanceApplyLogDto) => ({
  fileId: `${item.rootId}:${item.relativePath}`,
  status: item.status === "success" ? ("success" as const) : ("failed" as const),
  ...(item.error || item.status === "skipped" ? { error: item.error ?? "已跳过" } : {}),
});

export const applyWebTaskUpdate = (payload: WebTaskUpdateDto, previous: TaskHydrationState): TaskHydrationState => {
  const next = { ...previous, shouldOpenUncensoredDialog: false };

  if (payload.kind === "snapshot") {
    for (const task of payload.tasks) {
      if (task.kind === "scrape" && task.status !== "completed" && task.status !== "failed") {
        next.activeScrapeTaskId = task.id;
      }
      if (task.kind === "maintenance" && task.status !== "completed" && task.status !== "failed") {
        next.activeMaintenanceTaskId = task.id;
      }
    }
    return next;
  }

  if (payload.kind === "task") {
    if (payload.task.kind === "scrape") {
      next.activeScrapeTaskId = payload.task.id;
      const scrapeStatus = taskStatusToScrapeStatus(payload.task.status);
      const store = useScrapeStore.getState();
      store.setScrapeStatus(scrapeStatus);
      store.setScraping(scrapeStatus === "running" || scrapeStatus === "paused" || scrapeStatus === "stopping");
      store.updateProgress(payload.task.videoCount, payload.task.videos?.length ?? payload.task.videoCount);
    }

    if (payload.task.kind === "maintenance") {
      next.activeMaintenanceTaskId = payload.task.id;
      useMaintenanceExecutionStore.getState().setExecutionStatus(taskStatusToMaintenanceStatus(payload.task.status));
    }

    return next;
  }

  if (payload.kind === "event" && payload.event.type === "completed" && payload.ambiguousUncensoredItems?.length) {
    next.uncensoredTaskId = payload.event.taskId;
    next.ambiguousUncensoredItems = payload.ambiguousUncensoredItems;
    next.shouldOpenUncensoredDialog = true;
  }

  return next;
};

export const applyTaskRealtimeEvent = (
  payload: TaskRealtimeEventDto,
  previous: TaskHydrationState,
): TaskHydrationState => {
  const next = { ...previous, shouldOpenUncensoredDialog: false };

  switch (payload.kind) {
    case "log":
      return next;
    case "task-progress":
      if (payload.taskKind === "scrape") {
        useScrapeStore.getState().updateProgress(payload.current, payload.total);
      }
      if (payload.taskKind === "maintenance") {
        useMaintenanceExecutionStore
          .getState()
          .setProgress(
            payload.total > 0 ? Math.round((payload.current / payload.total) * 100) : 0,
            payload.current,
            payload.total,
          );
      }
      return next;
    case "scrape-stage":
      next.activeScrapeTaskId = payload.taskId;
      next.latestScrapeStage = {
        taskId: payload.taskId,
        stage: payload.stage,
        message: payload.message,
        ...(payload.relativePath ? { relativePath: payload.relativePath } : {}),
      };
      return next;
    case "scrape-result":
      next.activeScrapeTaskId = payload.taskId;
      useScrapeStore.getState().upsertResult(scrapeResultDtoToScrapeResult(payload.result));
      return next;
    case "task-failed":
      next.latestTaskFailure = {
        taskId: payload.taskId,
        message: payload.message,
        ...(payload.error !== undefined ? { error: payload.error } : {}),
      };
      if (previous.activeScrapeTaskId === payload.taskId) {
        const store = useScrapeStore.getState();
        store.setScrapeStatus("idle");
        store.setScraping(false);
      }
      if (previous.activeMaintenanceTaskId === payload.taskId) {
        useMaintenanceExecutionStore.getState().setExecutionStatus("idle");
      }
      return next;
    case "maintenance-preview-item":
      next.activeMaintenanceTaskId = payload.taskId;
      useMaintenancePreviewStore.getState().upsertPreviewItem(maintenancePreviewDtoToPreviewItem(payload.item));
      return next;
    case "maintenance-apply-item":
      next.activeMaintenanceTaskId = payload.taskId;
      applyMaintenanceExecutionItemResult(maintenanceApplyLogDtoToItemResult(payload.item));
      return next;
  }
};
