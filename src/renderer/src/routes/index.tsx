import { toErrorMessage } from "@shared/error";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, PauseCircle, Play, RotateCcw, StopCircle } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { pauseScrape, resumeScrape, retryScrapeSelection, startBatchScrape, stopScrape } from "@/api/manual";
import { chooseMediaDirectory, isMediaDirectorySelectionCancelled } from "@/client/mediaPath";
import MaintenanceBatchBar from "@/components/maintenance/MaintenanceBatchBar";
import { PageHeader } from "@/components/PageHeader";
import { UncensoredConfirmDialog } from "@/components/UncensoredConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TabButton } from "@/components/ui/TabButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { CURRENT_CONFIG_QUERY_KEY, useCurrentConfig } from "@/hooks/useCurrentConfig";
import { buildAmbiguousUncensoredScrapeGroups } from "@/lib/scrapeResultGrouping";
import { useMaintenanceExecutionStore } from "@/store/maintenanceExecutionStore";
import { useScrapeStore } from "@/store/scrapeStore";
import { useUIStore } from "@/store/uiStore";

const ScrapeWorkbench = lazy(() => import("@/components/maintenance/ScrapeWorkbench"));
const MaintenanceWorkbench = lazy(() => import("@/components/maintenance/MaintenanceWorkbench"));

export const Route = createFileRoute("/")({
  component: Index,
});

function DisabledModeButton({ label, tooltip, active }: { label: string; tooltip: string; active: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <TabButton isActive={active} disabled className="h-9 rounded-lg px-5 text-sm">
            {label}
          </TabButton>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function Index() {
  const queryClient = useQueryClient();
  const [uncensoredDialogOpen, setUncensoredDialogOpen] = useState(false);
  const configQ = useCurrentConfig();

  const {
    isScraping,
    scrapeStatus,
    results,
    setScraping,
    setScrapeStatus,
    updateProgress,
    setStatusText,
    clearResults,
  } = useScrapeStore(
    useShallow((state) => ({
      isScraping: state.isScraping,
      scrapeStatus: state.scrapeStatus,
      results: state.results,
      setScraping: state.setScraping,
      setScrapeStatus: state.setScrapeStatus,
      updateProgress: state.updateProgress,
      setStatusText: state.setStatusText,
      clearResults: state.clearResults,
    })),
  );
  const maintenanceStatus = useMaintenanceExecutionStore((state) => state.executionStatus);
  const { workbenchMode, setWorkbenchMode, setSelectedResultId } = useUIStore(
    useShallow((state) => ({
      workbenchMode: state.workbenchMode,
      setWorkbenchMode: state.setWorkbenchMode,
      setSelectedResultId: state.setSelectedResultId,
    })),
  );

  const maintenanceBusy = maintenanceStatus !== "idle";
  const ambiguousItems = useMemo(() => buildAmbiguousUncensoredScrapeGroups(results), [results]);
  const failedPaths = useMemo(
    () => results.filter((result) => result.status === "failed").map((result) => result.fileInfo.filePath),
    [results],
  );
  const mediaPath = configQ.data?.paths?.mediaPath?.trim() ?? "";

  // Detect scrape completion and check for ambiguous uncensored items
  const prevScrapeStatusRef = useRef(scrapeStatus);
  useEffect(() => {
    const prev = prevScrapeStatusRef.current;
    prevScrapeStatusRef.current = scrapeStatus;

    if ((prev === "running" || prev === "stopping") && scrapeStatus === "idle" && ambiguousItems.length > 0) {
      setUncensoredDialogOpen(true);
    }
  }, [ambiguousItems, scrapeStatus]);

  const refreshCurrentConfig = async () => {
    await queryClient.invalidateQueries({ queryKey: CURRENT_CONFIG_QUERY_KEY });
  };

  const handleChooseMediaDirectory = async () => {
    try {
      await chooseMediaDirectory(configQ.data);
      await refreshCurrentConfig();
      toast.success("媒体目录已更新");
    } catch (error) {
      if (isMediaDirectorySelectionCancelled(error)) {
        return;
      }
      toast.error(`目录设置失败: ${toErrorMessage(error)}`);
    }
  };

  const handleStartScrape = async () => {
    if (maintenanceBusy) {
      toast.warning("维护模式正在运行中，无法启动正常刮削。请先停止当前维护任务。");
      return;
    }

    try {
      updateProgress(0, 0);
      clearResults();
      setSelectedResultId(null);
      const response = await startBatchScrape();
      setScraping(true);
      await refreshCurrentConfig();
      toast.success(response.data.message);
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      if (isMediaDirectorySelectionCancelled(error)) {
        return;
      }

      if (errorMessage.includes("NO_FILES")) {
        toast.info("当前目录中没有需要刮削的媒体文件");
        return;
      }

      toast.error(`启动失败: ${errorMessage}`);
    }
  };

  const handleStopScrape = async () => {
    if (!window.confirm("确定要停止刮削吗？")) return;
    try {
      await stopScrape();
      setScrapeStatus("stopping");
      setStatusText("正在停止...");
      toast.info("正在停止...");
    } catch (_error) {
      toast.error("停止失败");
    }
  };

  const handlePauseScrape = async () => {
    try {
      await pauseScrape();
      setScrapeStatus("paused");
      setStatusText("已暂停");
      toast.info("任务已暂停");
    } catch (_error) {
      toast.error("暂停失败");
    }
  };

  const handleResumeScrape = async () => {
    try {
      await resumeScrape();
      setScrapeStatus("running");
      setStatusText("已恢复");
      toast.success("任务已恢复");
    } catch (_error) {
      toast.error("恢复失败");
    }
  };

  const resetForNewTask = () => {
    clearResults();
    updateProgress(0, 0);
    setScraping(true);
    setScrapeStatus("running");
    setSelectedResultId(null);
  };

  const handleRetryFailed = async () => {
    if (failedPaths.length === 0) {
      toast.info("当前没有可重试的失败项目");
      return;
    }

    if (!window.confirm(`确定要批量重试 ${failedPaths.length} 个失败项目吗？`)) {
      return;
    }

    try {
      const result = await retryScrapeSelection(failedPaths, {
        scrapeStatus,
      });
      if (result.data.strategy === "new-task") {
        resetForNewTask();
      }
      toast.success(result.data.message);
    } catch (error) {
      toast.error(`重试失败: ${toErrorMessage(error)}`);
    }
  };

  const pageExtra =
    workbenchMode === "scrape" ? (
      <>
        {isScraping && scrapeStatus !== "stopping" && (
          <Button
            variant="outline"
            onClick={scrapeStatus === "paused" ? handleResumeScrape : handlePauseScrape}
            className="h-9 rounded-lg px-5"
          >
            {scrapeStatus === "paused" ? (
              <>
                <Play className="mr-2 h-4 w-4" /> 恢复任务
              </>
            ) : (
              <>
                <PauseCircle className="mr-2 h-4 w-4" /> 暂停任务
              </>
            )}
          </Button>
        )}
        <Button
          variant={isScraping ? "destructive" : "default"}
          onClick={isScraping ? handleStopScrape : handleStartScrape}
          className="h-9 rounded-lg px-6 font-semibold shadow-sm"
        >
          {isScraping ? (
            <>
              <StopCircle className="mr-2 h-4 w-4" /> 停止任务
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> 开始刮削
            </>
          )}
        </Button>
      </>
    ) : (
      <MaintenanceBatchBar mediaPath={mediaPath} />
    );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="工作台"
        icon={LayoutDashboard}
        subtitle={
          mediaPath ? (
            <span className="flex items-baseline gap-1">
              当前目录:
              <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{mediaPath}</code>
            </span>
          ) : (
            "尚未配置媒体目录"
          )
        }
        extra={pageExtra}
      />

      <div className="px-8 pb-2 border-b bg-background/60 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {maintenanceBusy ? (
              <DisabledModeButton
                label="正常刮削"
                tooltip="维护模式执行中，暂时不能切换到正常刮削。"
                active={workbenchMode === "scrape"}
              />
            ) : (
              <TabButton
                isActive={workbenchMode === "scrape"}
                className="h-9 rounded-lg px-5 text-sm"
                onClick={() => setWorkbenchMode("scrape")}
              >
                正常刮削
              </TabButton>
            )}

            {isScraping ? (
              <DisabledModeButton
                label="维护模式"
                tooltip="正常刮削执行中，暂时不能切换到维护模式。"
                active={workbenchMode === "maintenance"}
              />
            ) : (
              <TabButton
                isActive={workbenchMode === "maintenance"}
                className="h-9 rounded-lg px-5 text-sm"
                onClick={() => setWorkbenchMode("maintenance")}
              >
                维护模式
              </TabButton>
            )}
          </div>

          {failedPaths.length > 0 && !isScraping && workbenchMode === "scrape" && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg h-9 px-4 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 whitespace-nowrap"
              onClick={handleRetryFailed}
            >
              <RotateCcw className="h-4 w-4" />
              重试失败
              <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                {failedPaths.length}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载中...</div>
          }
        >
          {workbenchMode === "scrape" ? (
            <ScrapeWorkbench
              mediaPath={mediaPath}
              onChooseMediaDirectory={handleChooseMediaDirectory}
              onStartScrape={handleStartScrape}
            />
          ) : (
            <MaintenanceWorkbench />
          )}
        </Suspense>
      </div>

      <UncensoredConfirmDialog
        open={uncensoredDialogOpen && ambiguousItems.length > 0}
        onOpenChange={setUncensoredDialogOpen}
        items={ambiguousItems}
      />
    </div>
  );
}
