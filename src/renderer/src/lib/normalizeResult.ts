import type { ScrapeResult as BackendScrapeResult } from "@shared/types";
import { deriveGroupingDirectoryFromPath } from "@/lib/multipartDisplay";
import type { ScrapeResult } from "@/store/scrapeStore";

export const formatDuration = (durationSeconds: number | undefined): string | undefined => {
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return undefined;
  }

  const totalSeconds = Math.round(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const formatBitrate = (bitrateBps: number | undefined): string | undefined => {
  if (typeof bitrateBps !== "number" || !Number.isFinite(bitrateBps) || bitrateBps <= 0) {
    return undefined;
  }

  return `${(bitrateBps / 1_000_000).toFixed(1)} Mbps`;
};

export const normalizeResultItem = (payload: BackendScrapeResult): ScrapeResult => {
  const data = payload.crawlerData;
  const assets = payload.assets;
  const remotePoster = data?.poster_url;
  const remoteThumb = data?.thumb_url ?? data?.fanart_url;
  const remoteFanart = data?.fanart_url ?? data?.thumb_url;

  return {
    fileId: payload.fileId,
    status: payload.status === "failed" ? "failed" : "success",
    number: payload.fileInfo.number,
    path: payload.fileInfo.filePath,
    title: data?.title_zh ?? data?.title,
    actors: data?.actors,
    outline: data?.plot_zh ?? data?.plot,
    tags: data?.genres,
    release: data?.release_date,
    duration: formatDuration(payload.videoMeta?.durationSeconds ?? data?.durationSeconds),
    resolution:
      payload.videoMeta && payload.videoMeta.width > 0 && payload.videoMeta.height > 0
        ? `${payload.videoMeta.width}x${payload.videoMeta.height}`
        : undefined,
    codec: payload.videoMeta?.codec,
    bitrate: formatBitrate(payload.videoMeta?.bitrate),
    directors: data?.director ? [data.director] : undefined,
    series: data?.series,
    studio: data?.studio,
    publisher: data?.publisher,
    score: typeof data?.rating === "number" ? String(data.rating) : undefined,
    posterUrl: assets?.poster ?? remotePoster,
    thumbUrl: assets?.thumb ?? assets?.fanart ?? remoteThumb,
    fanartUrl: assets?.fanart ?? assets?.thumb ?? remoteFanart,
    sceneImages: assets?.sceneImages,
    sources: payload.sources as Record<string, string> | undefined,
    errorMessage: payload.error,
    uncensoredAmbiguous: payload.uncensoredAmbiguous,
    nfoPath: payload.nfoPath,
    part: payload.fileInfo.part,
    outputPath: payload.outputPath ?? deriveGroupingDirectoryFromPath(payload.fileInfo.filePath),
  };
};
