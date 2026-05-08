import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export const WATERMARK_DIRECTORY_NAME = "watermark";

export const resolveWatermarkDirectory = (dataDir: string): string => join(dataDir, WATERMARK_DIRECTORY_NAME);

export const ensureWatermarkDirectory = async (dataDir: string): Promise<string> => {
  const directoryPath = resolveWatermarkDirectory(dataDir);
  await mkdir(directoryPath, { recursive: true });
  return directoryPath;
};
