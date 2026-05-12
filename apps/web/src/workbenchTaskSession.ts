import { useWorkbenchTaskStore } from "@mdcz/shared/stores/workbenchTaskStore";

const ACTIVE_SCRAPE_TASK_ID_KEY = "mdcz-web-active-scrape-task-id";
const ACTIVE_MAINTENANCE_TASK_ID_KEY = "mdcz-web-active-maintenance-task-id";

export interface WebWorkbenchTaskIds {
  activeScrapeTaskId: string;
  activeMaintenanceTaskId: string;
}

const canUseSessionStorage = (): boolean => typeof window !== "undefined" && "sessionStorage" in window;

const readSessionValue = (key: string): string => {
  if (!canUseSessionStorage()) return "";
  return window.sessionStorage.getItem(key)?.trim() ?? "";
};

const writeSessionValue = (key: string, value: string): void => {
  if (!canUseSessionStorage()) return;
  const trimmed = value.trim();
  if (trimmed) {
    window.sessionStorage.setItem(key, trimmed);
    return;
  }
  window.sessionStorage.removeItem(key);
};

export const readWebWorkbenchTaskIds = (): WebWorkbenchTaskIds => ({
  activeScrapeTaskId: readSessionValue(ACTIVE_SCRAPE_TASK_ID_KEY),
  activeMaintenanceTaskId: readSessionValue(ACTIVE_MAINTENANCE_TASK_ID_KEY),
});

export const persistWebWorkbenchTaskIds = (ids: WebWorkbenchTaskIds): void => {
  writeSessionValue(ACTIVE_SCRAPE_TASK_ID_KEY, ids.activeScrapeTaskId);
  writeSessionValue(ACTIVE_MAINTENANCE_TASK_ID_KEY, ids.activeMaintenanceTaskId);
};

export const syncWebWorkbenchTaskIdsFromStore = (): (() => void) =>
  useWorkbenchTaskStore.subscribe((state) => {
    persistWebWorkbenchTaskIds({
      activeScrapeTaskId: state.hydrationState.activeScrapeTaskId,
      activeMaintenanceTaskId: state.hydrationState.activeMaintenanceTaskId,
    });
  });
