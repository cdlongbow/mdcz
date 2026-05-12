import { scrapeResultDtoToScrapeResult } from "@mdcz/shared/dtoAdapters";
import { toErrorMessage } from "@mdcz/shared/error";
import { SUPPORTED_MEDIA_EXTENSIONS } from "@mdcz/shared/mediaExtensions";
import type { ScrapeResultDto } from "@mdcz/shared/serverDtos";
import { useScrapeStore } from "@mdcz/shared/stores/scrapeStore";
import { useUIStore } from "@mdcz/shared/stores/uiStore";
import { useWorkbenchTaskStore } from "@mdcz/shared/stores/workbenchTaskStore";
import { applyTaskRealtimeEvent, applyWebTaskUpdate, hydrateWorkbenchScrapeResults } from "@mdcz/shared/taskHydration";
import type { MaintenancePresetId, ScrapeResult } from "@mdcz/shared/types";
import {
  activateNewScrapeTask,
  applyScrapeTaskStatus,
  buildUncensoredConfirmationItems,
  getFailedScrapeTargets,
  MaintenanceWorkbenchAdapter,
  resetScrapeWorkbenchToSetup,
  ScrapeWorkbenchAdapter,
  type SharedWorkbenchPorts,
  startMaintenanceFlow,
  useWorkbenchSessionSnapshot,
  WorkbenchSetupAdapter,
  type WorkbenchSetupPort,
} from "@mdcz/views/adapters";
import { UncensoredConfirmDialog, type UncensoredConfirmSelection } from "@mdcz/views/scrape";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { createWebWorkbenchPorts } from "../adapters/ports";
import { api, subscribeTaskRealtime } from "../client";
import { persistWebWorkbenchTaskIds, readWebWorkbenchTaskIds } from "../workbenchTaskSession";

export const Route = createFileRoute("/workbench")({
  validateSearch: (search): { intent?: "maintenance" } => ({
    intent: search.intent === "maintenance" ? "maintenance" : undefined,
  }),
  component: WorkbenchPage,
});

const createWebSetupPort = (): WorkbenchSetupPort => ({
  browseDirectory: async (_kind, currentPath) => {
    return currentPath || null;
  },
  isServer: true,
  suggestDirectory: async ({ kind, path }) =>
    await api.serverPaths.suggest({
      path,
      intent: kind === "scan" ? "workbench-scan" : "workbench-output",
    }),
  scanCandidates: async (scanDir) => {
    const result = await api.scans.candidates({
      scanDir,
      supportedExtensions: [...SUPPORTED_MEDIA_EXTENSIONS],
    });
    return {
      candidates: result.candidates,
      supportedExtensions: [...SUPPORTED_MEDIA_EXTENSIONS],
    };
  },
  savePaths: async (scanDir, targetDir) => {
    await api.config.save({
      paths: {
        mediaPath: scanDir,
        successOutputFolder: targetDir,
      },
    });
  },
});

const scrapeResultsToRetryTargets = (results: ScrapeResult[]) =>
  results
    .filter((result) => result.status === "failed")
    .map((result) => {
      const [rootId, ...relativeParts] = result.fileId.split(":");
      const relativePath = relativeParts.join(":");
      return {
        filePath: result.fileInfo.filePath,
        ref: rootId && relativePath ? { rootId, relativePath } : undefined,
      };
    });

const canControlScrapeTask = (input: { isScraping: boolean; activeTaskId: string }): boolean =>
  !input.isScraping || input.activeTaskId.trim().length > 0;

const shouldShowWorkbenchSetup = (input: {
  baseShowSetup: boolean;
  workbenchMode: "scrape" | "maintenance";
  isScraping: boolean;
  activeTaskId: string;
  scrapeStartPending?: boolean;
}): boolean => {
  if (input.workbenchMode === "scrape" && (input.scrapeStartPending || input.activeTaskId.trim())) {
    return false;
  }

  return (
    input.baseShowSetup ||
    (input.workbenchMode === "scrape" &&
      !canControlScrapeTask({ isScraping: input.isScraping, activeTaskId: input.activeTaskId }))
  );
};

function WorkbenchPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const ports = useMemo<SharedWorkbenchPorts>(() => createWebWorkbenchPorts(), []);
  const setupPort = useMemo(() => createWebSetupPort(), []);
  const [uncensoredDialogOpen, setUncensoredDialogOpen] = useState(false);
  const [persistedTaskIds, setPersistedTaskIds] = useState(readWebWorkbenchTaskIds);
  const {
    hydrationState,
    scrapeStartPending,
    resolveUncensoredTask,
    setActiveMaintenanceTaskId,
    setActiveScrapeTaskId,
    setHydrationState,
    setScrapeStartPending,
  } = useWorkbenchTaskStore(
    useShallow((state) => ({
      hydrationState: state.hydrationState,
      scrapeStartPending: state.scrapeStartPending,
      resolveUncensoredTask: state.resolveUncensoredTask,
      setActiveMaintenanceTaskId: state.setActiveMaintenanceTaskId,
      setActiveScrapeTaskId: state.setActiveScrapeTaskId,
      setHydrationState: state.setHydrationState,
      setScrapeStartPending: state.setScrapeStartPending,
    })),
  );
  const activeScrapeTaskId = hydrationState.activeScrapeTaskId || persistedTaskIds.activeScrapeTaskId;
  const configQ = useQuery({ queryFn: () => api.config.read(), queryKey: ["config"], retry: false });
  const tasksQ = useQuery({ queryFn: () => api.tasks.list(), queryKey: ["tasks"], retry: false });
  const scrapeResultsQ = useQuery({
    enabled: activeScrapeTaskId.trim().length > 0,
    queryFn: () => api.scrape.listResults({ taskId: activeScrapeTaskId }),
    queryKey: ["scrapeResults", activeScrapeTaskId || "none"],
    retry: false,
  });

  const { isScraping, scrapeStatus, results } = useScrapeStore(
    useShallow((state) => ({
      isScraping: state.isScraping,
      scrapeStatus: state.scrapeStatus,
      results: state.results,
    })),
  );
  const { workbenchMode, setWorkbenchMode } = useUIStore(
    useShallow((state) => ({
      workbenchMode: state.workbenchMode,
      setWorkbenchMode: state.setWorkbenchMode,
    })),
  );

  const sessionSnapshot = useWorkbenchSessionSnapshot(workbenchMode, search.intent);
  const showSetup = shouldShowWorkbenchSetup({
    baseShowSetup: sessionSnapshot.showSetup,
    workbenchMode,
    isScraping,
    activeTaskId: activeScrapeTaskId,
    scrapeStartPending,
  });
  const failedTargets = useMemo(() => scrapeResultsToRetryTargets(results), [results]);

  useEffect(
    () =>
      useWorkbenchTaskStore.subscribe((state) => {
        const nextIds = {
          activeScrapeTaskId: state.hydrationState.activeScrapeTaskId,
          activeMaintenanceTaskId: state.hydrationState.activeMaintenanceTaskId,
        };
        persistWebWorkbenchTaskIds(nextIds);
        setPersistedTaskIds(nextIds);
      }),
    [],
  );

  useEffect(() => {
    if (persistedTaskIds.activeScrapeTaskId && !useWorkbenchTaskStore.getState().hydrationState.activeScrapeTaskId) {
      setActiveScrapeTaskId(persistedTaskIds.activeScrapeTaskId);
    }
    if (
      persistedTaskIds.activeMaintenanceTaskId &&
      !useWorkbenchTaskStore.getState().hydrationState.activeMaintenanceTaskId
    ) {
      setActiveMaintenanceTaskId(persistedTaskIds.activeMaintenanceTaskId);
    }
  }, [persistedTaskIds, setActiveMaintenanceTaskId, setActiveScrapeTaskId]);

  useEffect(() => {
    if (sessionSnapshot.workbenchMode !== workbenchMode) {
      setWorkbenchMode(sessionSnapshot.workbenchMode);
    }
  }, [sessionSnapshot.workbenchMode, setWorkbenchMode, workbenchMode]);

  useEffect(() => {
    if (scrapeResultsQ.data) {
      const previous = useWorkbenchTaskStore.getState().hydrationState;
      const nextState = hydrateWorkbenchScrapeResults(
        scrapeResultsQ.data,
        activeScrapeTaskId ? { ...previous, activeScrapeTaskId } : previous,
      );
      setHydrationState(nextState);
    }
  }, [activeScrapeTaskId, scrapeResultsQ.data, setHydrationState]);

  useEffect(() => {
    if (!tasksQ.data) return;
    const nextState = applyWebTaskUpdate(
      {
        kind: "snapshot",
        tasks: tasksQ.data.tasks,
      },
      useWorkbenchTaskStore.getState().hydrationState,
    );
    setHydrationState(nextState);
  }, [setHydrationState, tasksQ.data]);

  useEffect(
    () =>
      subscribeTaskRealtime({
        onEvent: (payload) => {
          const nextState = applyTaskRealtimeEvent(payload, useWorkbenchTaskStore.getState().hydrationState);
          setHydrationState(nextState);
          if (payload.kind === "scrape-result") {
            queryClient.setQueriesData(
              { queryKey: ["scrapeResults"] },
              (previous: typeof scrapeResultsQ.data | undefined) => {
                if (!previous) return { results: [payload.result] };
                const existingIndex = previous.results.findIndex((result) => result.id === payload.result.id);
                if (existingIndex === -1) return { results: [...previous.results, payload.result] };
                const nextResults = [...previous.results];
                nextResults[existingIndex] = payload.result;
                return { results: nextResults };
              },
            );
          }
        },
        onUpdate: (payload) => {
          const nextState = applyWebTaskUpdate(payload, useWorkbenchTaskStore.getState().hydrationState);
          setHydrationState(nextState);
          if (nextState.shouldOpenUncensoredDialog) {
            setUncensoredDialogOpen(true);
          }
          void queryClient.invalidateQueries({ queryKey: ["scrapeResults"] });
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
      }),
    [queryClient, setHydrationState],
  );

  const handleStartSelectedScrape = async (filePaths: string[], scanDir: string, targetDir: string) => {
    setScrapeStartPending(true);
    try {
      activateNewScrapeTask();
      const task = await api.scrape.startSelectedFiles({ filePaths, scanDir, targetDir });
      setActiveScrapeTaskId(task.id);
      applyScrapeTaskStatus(task.status);
      toast.success("已启动选中文件刮削");
    } catch (error) {
      resetScrapeWorkbenchToSetup();
      toast.error(`启动失败: ${toErrorMessage(error)}`);
    } finally {
      setScrapeStartPending(false);
    }
  };

  const handleStartSelectedMaintenance = async (
    filePaths: string[],
    scanDir: string,
    _targetDir: string,
    presetId: MaintenancePresetId,
  ) => {
    await startMaintenanceFlow({
      filePaths,
      scanDir,
      presetId,
      port: ports.maintenance,
      isScraping,
      setWorkbenchMode,
      onRefreshConfig: async () => {
        await queryClient.invalidateQueries({ queryKey: ["config"] });
      },
      toast,
      toErrorMessage,
    });
  };

  const requireActiveScrapeTaskId = () => {
    if (!activeScrapeTaskId) {
      toast.info("当前没有可控制的刮削任务");
      return null;
    }
    return activeScrapeTaskId;
  };

  const handlePauseScrape = async () => {
    const taskId = requireActiveScrapeTaskId();
    if (!taskId) return;
    try {
      const task = await api.scrape.pause({ taskId });
      applyScrapeTaskStatus(task.status);
      toast.info("任务已暂停");
    } catch (error) {
      toast.error(`暂停失败: ${toErrorMessage(error)}`);
    }
  };

  const handleResumeScrape = async () => {
    const taskId = requireActiveScrapeTaskId();
    if (!taskId) return;
    try {
      const task = await api.scrape.resume({ taskId });
      applyScrapeTaskStatus(task.status);
      toast.success("任务已恢复");
    } catch (error) {
      toast.error(`恢复失败: ${toErrorMessage(error)}`);
    }
  };

  const handleStopScrape = async () => {
    const taskId = requireActiveScrapeTaskId();
    if (!taskId) return;
    try {
      const task = await api.scrape.stop({ taskId });
      applyScrapeTaskStatus(task.status);
      toast.info("正在停止...");
    } catch (error) {
      toast.error(`停止失败: ${toErrorMessage(error)}`);
    }
  };

  const handleRetryFailed = async () => {
    const targets = getFailedScrapeTargets();
    if (targets.length === 0) {
      toast.info("当前没有可重试的失败项目");
      return;
    }
    try {
      const result = await ports.scrape.retrySelection(targets, { scrapeStatus });
      if (result.strategy === "new-task") {
        applyScrapeTaskStatus("running");
      }
      toast.success(result.message);
    } catch (error) {
      toast.error(`重试失败: ${toErrorMessage(error)}`);
    }
  };

  const handleConfirmUncensored = async (selections: UncensoredConfirmSelection[]) => {
    if (!hydrationState.uncensoredTaskId) {
      throw new Error("缺少刮削任务 ID");
    }
    const task = await api.scrape.confirmUncensored({
      taskId: hydrationState.uncensoredTaskId,
      items: buildUncensoredConfirmationItems(hydrationState.ambiguousUncensoredItems, selections),
    });
    resolveUncensoredTask(task.id);
    applyScrapeTaskStatus(task.status);
    toast.success("已提交无码确认重刮任务");
  };

  return (
    <div className="h-full min-h-0 overflow-hidden">
      {showSetup ? (
        <WorkbenchSetupAdapter
          mode={workbenchMode}
          config={configQ.data}
          configLoading={configQ.isLoading}
          port={setupPort}
          onStartScrape={handleStartSelectedScrape}
          onStartMaintenance={handleStartSelectedMaintenance}
        />
      ) : workbenchMode === "scrape" ? (
        <ScrapeWorkbenchAdapter
          ports={ports}
          failedCount={failedTargets.length}
          onPauseScrape={() => void handlePauseScrape()}
          onResumeScrape={() => void handleResumeScrape()}
          onRetryFailed={() => void handleRetryFailed()}
          onStopScrape={() => void handleStopScrape()}
        />
      ) : (
        <MaintenanceWorkbenchAdapter ports={ports} />
      )}
      <UncensoredConfirmDialog
        open={uncensoredDialogOpen && hydrationState.ambiguousUncensoredItems.length > 0}
        items={hydrationState.ambiguousUncensoredItems}
        onOpenChange={setUncensoredDialogOpen}
        onConfirm={handleConfirmUncensored}
      />
    </div>
  );
}

export const __workbenchTestHooks = {
  canControlScrapeTask,
  dtoToScrapeResult: (result: ScrapeResultDto) => scrapeResultDtoToScrapeResult(result),
  shouldShowWorkbenchSetup,
  scrapeResultsToRetryTargets,
};
