import type { LocalScanEntry, MaintenanceItemResult, MaintenancePreviewItem, MaintenanceStatus } from "@shared/types";
import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { formatMaintenanceStatus } from "@/lib/formatMaintenanceStatus";
import { countMaintenanceDisplayItems } from "@/lib/maintenanceGrouping";

type MaintenanceExecutionStatus = MaintenanceStatus["state"];
const isDev = import.meta.env.DEV;

const createInitialState = () => ({
  executionStatus: "idle" as MaintenanceExecutionStatus,
  progressValue: 0,
  progressCurrent: 0,
  progressTotal: 0,
  statusText: "就绪",
  itemResults: {} as Record<string, MaintenanceItemResult>,
});

export interface MaintenanceExecutionState {
  executionStatus: MaintenanceExecutionStatus;
  progressValue: number;
  progressCurrent: number;
  progressTotal: number;
  statusText: string;
  itemResults: Record<string, MaintenanceItemResult>;

  setExecutionStatus: (status: MaintenanceExecutionStatus) => void;
  setStatusText: (text: string) => void;
  setProgress: (value: number, current: number, total: number) => void;
  beginExecution: (input: {
    entryIds: string[];
    previewResults?: Record<string, MaintenancePreviewItem>;
    displayCount: number;
  }) => void;
  rollbackExecutionStart: () => void;
  applyStatusSnapshot: (status: MaintenanceStatus, entries: LocalScanEntry[]) => void;
  applyItemResult: (payload: MaintenanceItemResult) => void;
  resetDerivedData: (statusText?: string) => void;
  reset: () => void;
}

type PersistedMaintenanceExecutionState = Pick<MaintenanceExecutionState, "itemResults">;

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const maintenanceExecutionStoreStorage = createJSONStorage<PersistedMaintenanceExecutionState>(() =>
  typeof sessionStorage !== "undefined" ? sessionStorage : noopStorage,
);

const partializeMaintenanceExecutionState = (state: MaintenanceExecutionState): PersistedMaintenanceExecutionState => ({
  itemResults: state.itemResults,
});

const mergePersistedMaintenanceExecutionState = (
  persisted: unknown,
  current: MaintenanceExecutionState,
): MaintenanceExecutionState => {
  const persistedState = (persisted ?? {}) as Partial<PersistedMaintenanceExecutionState>;

  return {
    ...current,
    ...persistedState,
    executionStatus: "idle",
    progressValue: 0,
    progressCurrent: 0,
    progressTotal: 0,
    statusText: "就绪",
  };
};

const createMaintenanceExecutionState: StateCreator<MaintenanceExecutionState> = (set) => ({
  ...createInitialState(),

  setExecutionStatus: (executionStatus) => set({ executionStatus }),

  setStatusText: (statusText) => set({ statusText }),

  setProgress: (value, current, total) =>
    set({
      progressValue: Math.max(0, Math.min(100, value)),
      progressCurrent: current,
      progressTotal: total,
    }),

  beginExecution: ({ entryIds, previewResults = {}, displayCount }) =>
    set((state) => {
      const nextResults = { ...state.itemResults };

      for (const entryId of entryIds) {
        const preview = previewResults[entryId];
        nextResults[entryId] = {
          ...nextResults[entryId],
          entryId,
          status: "pending",
          error: preview?.status === "blocked" ? preview.error : undefined,
          fieldDiffs: preview?.fieldDiffs,
          unchangedFieldDiffs: preview?.unchangedFieldDiffs,
          pathDiff: preview?.pathDiff,
        };
      }

      return {
        executionStatus: "executing",
        progressValue: 0,
        progressCurrent: 0,
        progressTotal: entryIds.length,
        statusText: `正在执行 ${displayCount || countMaintenanceDisplayItems([])} 项...`,
        itemResults: nextResults,
      };
    }),

  rollbackExecutionStart: () =>
    set({
      executionStatus: "idle",
      progressValue: 0,
      progressCurrent: 0,
      progressTotal: 0,
      itemResults: {},
    }),

  applyStatusSnapshot: (status, entries) =>
    set((state) => {
      const derivedProgress =
        status.totalEntries > 0 ? Math.round((status.completedEntries / status.totalEntries) * 100) : 0;
      const nextProgress =
        status.state === "executing" || status.state === "stopping"
          ? Math.max(state.progressValue, derivedProgress)
          : derivedProgress;

      return {
        executionStatus: status.state,
        progressValue: nextProgress,
        progressCurrent: status.completedEntries,
        progressTotal: status.totalEntries,
        statusText: formatMaintenanceStatus(
          status,
          entries,
          state.itemResults,
          state.statusText,
          state.executionStatus,
        ),
      };
    }),

  applyItemResult: (payload) =>
    set((state) => {
      const previousResult = state.itemResults[payload.entryId];

      return {
        itemResults: {
          ...state.itemResults,
          [payload.entryId]: {
            ...previousResult,
            ...payload,
          },
        },
      };
    }),

  resetDerivedData: (statusText = "就绪") =>
    set({
      executionStatus: "idle",
      progressValue: 0,
      progressCurrent: 0,
      progressTotal: 0,
      statusText,
      itemResults: {},
    }),

  reset: () =>
    set({
      ...createInitialState(),
    }),
});

export const useMaintenanceExecutionStore = isDev
  ? create<MaintenanceExecutionState>()(
      persist(createMaintenanceExecutionState, {
        name: "maintenance-execution-store",
        storage: maintenanceExecutionStoreStorage,
        partialize: partializeMaintenanceExecutionState,
        merge: mergePersistedMaintenanceExecutionState,
      }),
    )
  : create<MaintenanceExecutionState>()(createMaintenanceExecutionState);
