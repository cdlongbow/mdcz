import { pathExists } from "@main/utils/file";
import { isStrmFile } from "@main/utils/strm";
import type { ScrapeResult } from "@shared/types";
import { probeVideoMetadataOrWarn } from "../output";
import type { ScrapeContext } from "./ScrapeContext";
import type { FileScraperStageRuntime, ScrapeStage } from "./types";

export class ProbeStage implements ScrapeStage {
  constructor(private readonly runtime: FileScraperStageRuntime) {}

  async execute(context: ScrapeContext): Promise<void> {
    context.videoMeta = await probeVideoMetadataOrWarn({
      logger: this.runtime.logger,
      sourceVideoPath: context.fileInfo.filePath,
      warningPrefix: "Video probe failed",
    });

    if (!context.videoMeta && !isStrmFile(context.fileInfo.filePath) && (await pathExists(context.fileInfo.filePath))) {
      const configuration = context.configuration ?? (await this.runtime.getConfiguration());
      context.configuration = configuration;
      context.fileInfo = await this.runtime.handleFailedFileMove(context.fileInfo, configuration);

      const failedResult: ScrapeResult = {
        fileId: context.fileId,
        fileInfo: context.fileInfo,
        status: "failed",
        error: "Video probe failed",
      };

      this.runtime.setProgress(context.progress, 100);
      this.runtime.signalService.showScrapeResult(failedResult);
      this.runtime.signalService.showFailedInfo({
        fileInfo: context.fileInfo,
        error: "Video probe failed",
      });
      context.result = failedResult;
      return;
    }

    this.runtime.setProgress(context.progress, 30);
  }
}
