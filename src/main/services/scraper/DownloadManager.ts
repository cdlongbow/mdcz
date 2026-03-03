import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Configuration } from "@main/services/config";
import { loggerService } from "@main/services/LoggerService";
import type { NetworkClient } from "@main/services/network";
import type { CrawlerData, DownloadedAssets } from "@shared/types";

const normalizeUrl = (input?: string): string | null => {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
};

/** Optional callbacks for download progress reporting. */
export interface DownloadCallbacks {
  /** Called after each scene image completes (success or fail). */
  onSceneProgress?: (downloaded: number, total: number) => void;
}

export class DownloadManager {
  private readonly logger = loggerService.getLogger("DownloadManager");

  constructor(private readonly networkClient: NetworkClient) {}

  async downloadAll(
    outputDir: string,
    data: CrawlerData,
    config: Configuration,
    callbacks?: DownloadCallbacks,
  ): Promise<DownloadedAssets> {
    const assets: DownloadedAssets = {
      sceneImages: [],
      downloaded: [],
    };

    // Step 1: Download primary images (parallel, 3 concurrent)
    const primaryTasks: Array<{
      key: keyof Pick<DownloadedAssets, "cover" | "poster" | "fanart">;
      url: string | null;
      path: string;
    }> = [];

    if (config.download.downloadCover) {
      primaryTasks.push({ key: "cover", url: normalizeUrl(data.cover_url), path: join(outputDir, "cover.jpg") });
    }
    if (config.download.downloadPoster) {
      const posterUrl = normalizeUrl(data.poster_url);
      if (posterUrl) {
        primaryTasks.push({ key: "poster", url: posterUrl, path: join(outputDir, "poster.jpg") });
      }
    }
    if (config.download.downloadFanart) {
      const fanartUrl = normalizeUrl(data.fanart_url);
      if (fanartUrl) {
        primaryTasks.push({ key: "fanart", url: fanartUrl, path: join(outputDir, "fanart.jpg") });
      }
    }

    const primaryResults = await this.runParallel(
      primaryTasks
        .filter((t): t is typeof t & { url: string } => t.url !== null)
        .map((t) => ({ url: t.url, path: t.path, key: t.key })),
      3,
    );

    for (const result of primaryResults) {
      if (result.success) {
        assets[result.key] = result.path;
        assets.downloaded.push(result.path);
      }
    }

    // Step 2: Download scene images (parallel, 5 concurrent)
    if (config.download.downloadSceneImages) {
      const urls = (data.sample_images ?? [])
        .map((item) => normalizeUrl(item))
        .filter((item): item is string => !!item)
        .slice(0, config.aggregation.behavior.maxSceneImages);

      const sceneTasks = urls.map((url, index) => ({
        url,
        path: join(outputDir, config.paths.sceneImagesFolder, `scene-${String(index + 1).padStart(3, "0")}.jpg`),
        key: "sceneImages" as const,
      }));

      let sceneCompleted = 0;
      const sceneResults = await this.runParallel(sceneTasks, config.download.sceneImageConcurrency, () => {
        sceneCompleted++;
        callbacks?.onSceneProgress?.(sceneCompleted, sceneTasks.length);
      });

      for (const result of sceneResults) {
        if (result.success) {
          assets.sceneImages.push(result.path);
          assets.downloaded.push(result.path);
        }
      }
    }

    // Step 3: Derive missing images from cover
    const coverPath = assets.cover;
    if (coverPath) {
      if (config.download.downloadPoster && !assets.poster) {
        const posterPath = join(outputDir, "poster.jpg");
        try {
          await mkdir(dirname(posterPath), { recursive: true });
          await copyFile(coverPath, posterPath);
          assets.poster = posterPath;
          assets.downloaded.push(posterPath);
        } catch (error) {
          this.logger.warn(
            `Failed to derive poster from cover: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (config.download.downloadFanart && !assets.fanart) {
        const fanartPath = join(outputDir, "fanart.jpg");
        try {
          await mkdir(dirname(fanartPath), { recursive: true });
          await copyFile(coverPath, fanartPath);
          assets.fanart = fanartPath;
          assets.downloaded.push(fanartPath);
        } catch (error) {
          this.logger.warn(
            `Failed to derive fanart from cover: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    // Step 4: Download trailer (optional)
    if (config.download.downloadTrailer) {
      const url = normalizeUrl(data.trailer_url);
      if (url) {
        const trailerPath = join(outputDir, "trailer.mp4");
        const result = await this.safeDownload(url, trailerPath);
        if (result) {
          assets.trailer = trailerPath;
          assets.downloaded.push(trailerPath);
        }
      }
    }

    return assets;
  }

  private async runParallel<K extends string>(
    tasks: Array<{ url: string; path: string; key: K }>,
    maxConcurrent: number,
    onItemComplete?: () => void,
  ): Promise<Array<{ key: K; path: string; success: boolean }>> {
    const results: Array<{ key: K; path: string; success: boolean }> = [];
    let running = 0;
    let nextIndex = 0;

    if (tasks.length === 0) return results;

    return new Promise((resolve) => {
      const tryLaunchNext = (): void => {
        while (running < maxConcurrent && nextIndex < tasks.length) {
          const task = tasks[nextIndex++];
          running++;

          this.safeDownload(task.url, task.path)
            .then((downloadedPath) => {
              results.push({ key: task.key, path: task.path, success: !!downloadedPath });
            })
            .finally(() => {
              running--;
              onItemComplete?.();
              if (results.length === tasks.length) {
                resolve(results);
              } else {
                tryLaunchNext();
              }
            });
        }
      };

      tryLaunchNext();
    });
  }

  private async safeDownload(url: string, outputPath: string): Promise<string | null> {
    try {
      return await this.networkClient.download(url, outputPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Download failed for ${url}: ${message}`);
      return null;
    }
  }
}
