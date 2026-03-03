import type { CrawlerData } from "@shared/types";
import { ipc } from "@/client/ipc";
import type { ConfigOutput } from "@/client/types";

export interface ScrapeStatusResponse {
  status: "idle" | "running" | "stopping" | "paused";
  progress: number;
  total: number;
  current: number;
  current_path?: string;
}

export interface NfoResponse {
  path: string;
  content: string;
}

export interface RequeueResponse {
  message: string;
  running: boolean;
  queued: number;
}

const asNfoPath = (path: string): string => {
  if (path.toLowerCase().endsWith(".nfo")) {
    return path;
  }
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dot = path.lastIndexOf(".");
  if (dot > idx) {
    return `${path.slice(0, dot)}.nfo`;
  }
  return `${path}.nfo`;
};

const toProgress = (completedFiles: number, totalFiles: number): number => {
  if (totalFiles <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (completedFiles / totalFiles) * 100));
};

const parseCrawlerData = (content: string): CrawlerData => {
  return JSON.parse(content) as CrawlerData;
};

export const stopScrape = async () => {
  const data = await ipc.scraper.stop();
  return { data };
};

export const pauseScrape = async () => {
  const data = await ipc.scraper.pause();
  return { data };
};

export const resumeScrape = async () => {
  const data = await ipc.scraper.resume();
  return { data };
};

export const getScrapeStatus = async () => {
  const status = await ipc.scraper.getStatus();
  const data: ScrapeStatusResponse = {
    status: status.state,
    progress: toProgress(status.completedFiles, status.totalFiles),
    total: status.totalFiles,
    current: status.completedFiles,
  };
  return { data };
};

export const startBatchScrape = async () => {
  const currentConfig = (await ipc.config.get()) as ConfigOutput;
  let mediaPath = currentConfig.paths?.mediaPath?.trim() ?? "";

  if (!mediaPath) {
    const selection = await ipc.file.browse("directory");
    const paths = selection.paths ?? [];
    if (paths.length === 0) {
      throw new Error("No directory selected.");
    }

    mediaPath = paths[0]?.trim() ?? "";
    if (!mediaPath) {
      throw new Error("No directory selected.");
    }

    await ipc.config.save({
      paths: {
        ...(currentConfig.paths ?? {}),
        mediaPath,
      },
    });
  }

  const data = await ipc.scraper.start("batch", [mediaPath]);
  return { data };
};

export const deleteFile = async (path: string) => {
  const data = await ipc.file.delete([path]);
  return { data };
};

export const deleteFileAndFolder = async (path: string) => {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dir = slash > 0 ? path.slice(0, slash) : path;
  const data = await ipc.file.delete([path, dir]);
  return { data };
};

export const readNfo = async (path: string) => {
  const nfoPath = asNfoPath(path);
  const response = await ipc.file.nfoRead(nfoPath);
  const data: NfoResponse = {
    path: nfoPath,
    content: JSON.stringify(response.data, null, 2),
  };
  return { data };
};

export const updateNfo = async (path: string, content: string) => {
  const nfoPath = asNfoPath(path);
  const crawlerData = parseCrawlerData(content);
  const data = await ipc.file.nfoWrite(nfoPath, crawlerData);
  return { data };
};

export const requeueScrapeByNumber = async (path: string, _number: string) => {
  const result = await ipc.scraper.requeue([path]);
  const data: RequeueResponse = {
    message: `Requeued ${result.requeuedCount} file(s).`,
    running: false,
    queued: result.requeuedCount,
  };
  return { data };
};

export const requeueScrapeByUrl = async (path: string, _url: string) => {
  const result = await ipc.scraper.requeue([path]);
  const data: RequeueResponse = {
    message: `Requeued ${result.requeuedCount} file(s).`,
    running: false,
    queued: result.requeuedCount,
  };
  return { data };
};
