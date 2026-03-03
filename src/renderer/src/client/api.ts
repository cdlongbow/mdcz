import type { FileInfo } from "@shared/types";
import { ipc } from "./ipc";
import type { ConfigOutput, CreateSoftlinksBody, FileItem, ScrapeFileBody, UpdateConfigData } from "./types";

type ThrowOption = {
  throwOnError?: boolean;
};

const fileInfoToItem = (entry: FileInfo): FileItem => {
  const slash = Math.max(entry.filePath.lastIndexOf("/"), entry.filePath.lastIndexOf("\\"));
  const name = slash >= 0 ? entry.filePath.slice(slash + 1) : entry.filePath;
  return {
    type: "file",
    path: entry.filePath,
    name,
  };
};

export const getCurrentConfig = async (_options?: ThrowOption) => {
  const data = (await ipc.config.get()) as ConfigOutput;
  return { data };
};

export const updateConfig = async (options: UpdateConfigData & ThrowOption) => {
  const payload = (options.body ?? {}) as Record<string, unknown>;
  const data = await ipc.config.save(payload);
  return { data };
};

export const startScrape = async (_options?: ThrowOption) => {
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

export const scrapeSingleFile = async (options: { body: ScrapeFileBody } & ThrowOption) => {
  const path = options.body.path?.trim();
  if (!path) {
    throw new Error("Path is required");
  }
  const data = await ipc.scraper.start("single", [path]);
  return { data };
};

export const createSymlink = async (options: { body: CreateSoftlinksBody } & ThrowOption) => {
  const sourceDir = options.body.source_dir?.trim();
  const destDir = options.body.dest_dir?.trim();
  if (!sourceDir || !destDir) {
    throw new Error("Source and destination directories are required");
  }

  const data = await ipc.tool.createSymlink({
    sourceDir,
    destDir,
    copyFiles: Boolean(options.body.copy_files),
  });

  return { data };
};

export const listFiles = async (options: { query: { path: string } } & ThrowOption) => {
  const dirPath = options.query.path?.trim();
  if (!dirPath) {
    throw new Error("Path is required");
  }

  const response = await ipc.file.listDirectory(dirPath, false);
  return {
    data: {
      items: response.files.map(fileInfoToItem),
    },
  };
};
