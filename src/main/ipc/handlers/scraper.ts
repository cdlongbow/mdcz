import type { ServiceContainer } from "@main/container";
import { configManager, configurationSchema } from "@main/services/config";
import { loggerService } from "@main/services/LoggerService";
import { ScraperServiceError } from "@main/services/scraper";
import { fileOrganizer } from "@main/services/scraper/FileOrganizer";
import { LocalScanService } from "@main/services/scraper/maintenance/LocalScanService";
import { MaintenanceArtifactResolver } from "@main/services/scraper/maintenance/MaintenanceArtifactResolver";
import { nfoGenerator } from "@main/services/scraper/NfoGenerator";
import { toErrorMessage } from "@main/utils/common";
import { pathExists } from "@main/utils/file";
import { IpcChannel } from "@shared/IpcChannel";
import type { IpcRouterContract } from "@shared/ipcContract";
import type {
  DownloadedAssets,
  ScraperStatus,
  UncensoredConfirmItem,
  UncensoredConfirmResultItem,
} from "@shared/types";
import { createIpcError, IpcErrorCode } from "../errors";
import { asSerializableIpcError, t } from "../shared";

const logger = loggerService.getLogger("IpcRouter");
const localScanService = new LocalScanService();
const artifactResolver = new MaintenanceArtifactResolver();

const EMPTY_DOWNLOADED_ASSETS = (): DownloadedAssets => ({
  sceneImages: [],
  downloaded: [],
});

const defaultScraperStatus = (): ScraperStatus => ({
  state: "idle",
  running: false,
  totalFiles: 0,
  completedFiles: 0,
  successCount: 0,
  failedCount: 0,
  skippedCount: 0,
});

export const createScraperHandlers = (
  context: ServiceContainer,
): Pick<
  IpcRouterContract,
  | typeof IpcChannel.Scraper_GetStatus
  | typeof IpcChannel.Scraper_GetFailedFiles
  | typeof IpcChannel.Scraper_HasRecoverableSession
  | typeof IpcChannel.Scraper_RecoverSession
  | typeof IpcChannel.Scraper_Start
  | typeof IpcChannel.Scraper_Stop
  | typeof IpcChannel.Scraper_Pause
  | typeof IpcChannel.Scraper_Resume
  | typeof IpcChannel.Scraper_Requeue
  | typeof IpcChannel.Scraper_RetryFailed
  | typeof IpcChannel.Scraper_ConfirmUncensored
> => {
  const { scraperService } = context;

  return {
    [IpcChannel.Scraper_GetStatus]: t.procedure.action(async () => {
      return scraperService.getStatus() ?? defaultScraperStatus();
    }),
    [IpcChannel.Scraper_GetFailedFiles]: t.procedure.action(async () => {
      try {
        return { filePaths: scraperService.getFailedFiles() };
      } catch (error) {
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_HasRecoverableSession]: t.procedure.action(async () => {
      try {
        return { recoverable: await scraperService.hasRecoverableSession() };
      } catch (error) {
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_RecoverSession]: t.procedure.action(async () => {
      try {
        return await scraperService.recoverSession();
      } catch (error) {
        if (error instanceof ScraperServiceError) {
          throw createIpcError(error.code, error.message);
        }
        logger.error(`Failed to recover scrape session: ${toErrorMessage(error)}`);
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_Start]: t.procedure
      .input<{ mode?: "single" | "batch"; paths?: string[] }>()
      .action(async ({ input }) => {
        try {
          const mode = input?.mode ?? "single";
          const paths = input?.paths ?? [];
          return await scraperService.start(mode, paths);
        } catch (error) {
          if (error instanceof ScraperServiceError) {
            throw createIpcError(error.code, error.message);
          }
          logger.error(`Failed to start scraper: ${toErrorMessage(error)}`);
          throw asSerializableIpcError(error);
        }
      }),
    [IpcChannel.Scraper_Stop]: t.procedure.action(async () => {
      try {
        return {
          success: true as const,
          pendingCount: scraperService.stop().pendingCount,
        };
      } catch (error) {
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_Pause]: t.procedure.action(async () => {
      try {
        scraperService.pause();
        return { success: true as const };
      } catch (error) {
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_Resume]: t.procedure.action(async () => {
      try {
        scraperService.resume();
        return { success: true as const };
      } catch (error) {
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_Requeue]: t.procedure.input<{ filePaths?: string[] }>().action(async ({ input }) => {
      try {
        return await scraperService.requeue(input?.filePaths ?? []);
      } catch (error) {
        if (error instanceof ScraperServiceError) {
          throw createIpcError(error.code, error.message);
        }
        logger.error(`Failed to requeue files: ${toErrorMessage(error)}`);
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_RetryFailed]: t.procedure.input<{ filePaths?: string[] }>().action(async ({ input }) => {
      try {
        return await scraperService.retryFiles(input?.filePaths ?? []);
      } catch (error) {
        if (error instanceof ScraperServiceError) {
          throw createIpcError(error.code, error.message);
        }
        logger.error(`Failed to retry files: ${toErrorMessage(error)}`);
        throw asSerializableIpcError(error);
      }
    }),
    [IpcChannel.Scraper_ConfirmUncensored]: t.procedure
      .input<{ items?: UncensoredConfirmItem[] }>()
      .action(async ({ input }) => {
        const items = input?.items ?? [];
        if (items.length === 0) {
          return { updatedCount: 0, items: [] };
        }

        let updatedCount = 0;
        const updatedItems: UncensoredConfirmResultItem[] = [];
        const config = configurationSchema.parse(await configManager.get());
        if (!config.download.generateNfo) {
          logger.warn("Rejecting uncensored confirm because NFO generation is disabled");
          throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, "已关闭 NFO 生成功能，无法确认无码类型");
        }

        for (const item of items) {
          try {
            const nfoPath = item.nfoPath?.trim();
            const videoPath = item.videoPath?.trim();
            if (!nfoPath || !videoPath || !(await pathExists(nfoPath)) || !(await pathExists(videoPath))) {
              logger.warn(`Skipping uncensored confirm: source files not found for ${videoPath || nfoPath}`);
              continue;
            }

            const entry = await localScanService.scanVideo(videoPath, config.paths.sceneImagesFolder);
            const effectiveNfoPath = entry.nfoPath ?? nfoPath;
            if (!effectiveNfoPath || !entry.crawlerData || !(await pathExists(effectiveNfoPath))) {
              logger.warn(`Skipping uncensored confirm: incomplete local scan for ${videoPath}`);
              continue;
            }

            const nextLocalState = {
              ...entry.nfoLocalState,
              uncensoredChoice: item.choice,
            };
            const rawPlan = fileOrganizer.plan(entry.fileInfo, entry.crawlerData, config, nextLocalState);
            const plan = await fileOrganizer.ensureOutputReady(rawPlan, entry.fileInfo.filePath);
            const outputVideoPath = await fileOrganizer.organizeVideo(entry.fileInfo, plan, config);
            const savedNfoPath = await nfoGenerator.writeNfo(plan.nfoPath, entry.crawlerData, {
              fileInfo: entry.fileInfo,
              localState: nextLocalState,
            });
            const resolvedArtifacts = await artifactResolver.resolve({
              entry: {
                ...entry,
                nfoLocalState: nextLocalState,
              },
              plan,
              outputVideoPath,
              assets: EMPTY_DOWNLOADED_ASSETS(),
              savedNfoPath,
            });

            updatedCount += 1;
            updatedItems.push({
              sourceVideoPath: videoPath,
              sourceNfoPath: effectiveNfoPath,
              targetVideoPath: outputVideoPath,
              targetNfoPath: resolvedArtifacts.nfoPath,
              choice: item.choice,
            });
            logger.info(`Updated uncensored choice to "${item.choice}" for ${videoPath}`);
          } catch (error) {
            logger.warn(`Failed to update uncensored tag for ${item.videoPath}: ${toErrorMessage(error)}`);
          }
        }

        return { updatedCount, items: updatedItems };
      }),
  };
};
