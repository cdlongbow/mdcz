import { ipc } from "@/client/ipc";

export const SCRAPE_FILE_FILTERS = [
  {
    name: "媒体文件",
    extensions: ["mp4", "avi", "rmvb", "wmv", "mov", "mkv", "flv", "ts", "webm", "iso", "mpg", "strm"],
  },
];

export const chooseScrapeFilePath = async (): Promise<string | null> => {
  const selection = await ipc.file.browse("file", SCRAPE_FILE_FILTERS);
  const selectedPath = selection.paths?.[0]?.trim() ?? "";
  return selectedPath || null;
};
