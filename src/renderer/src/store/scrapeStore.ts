import type { UncensoredConfirmResultItem } from "@shared/types";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface ScrapeResult {
  id: string;
  status: "success" | "failed";
  number: string;
  title?: string;
  path: string;
  actors?: string[];
  outline?: string;
  tags?: string[];
  release?: string;
  duration?: string;
  resolution?: string;
  codec?: string;
  bitrate?: string;
  directors?: string[];
  series?: string;
  studio?: string;
  publisher?: string;
  score?: string;
  posterUrl?: string;
  thumbUrl?: string;
  fanartUrl?: string;
  outputPath?: string;
  sceneImages?: string[];
  /** Maps field names to the website that provided the value. */
  sources?: Record<string, string>;
  errorMessage?: string;
  /** True when the video is classified as uncensored but the specific type (破解/流出) is unknown. */
  uncensoredAmbiguous?: boolean;
  /** NFO path for post-scrape operations like uncensored confirmation. */
  nfoPath?: string;
}

interface ScrapeState {
  isScraping: boolean;
  scrapeStatus: "idle" | "running" | "stopping" | "paused";
  progress: number;
  total: number;
  current: number;
  failedCount: number;
  results: ScrapeResult[];
  currentFilePath: string;
  statusText: string;

  setScraping: (isScraping: boolean) => void;
  setScrapeStatus: (status: "idle" | "running" | "stopping" | "paused") => void;
  updateProgress: (current: number, total: number) => void;
  addResult: (result: ScrapeResult) => void;
  clearResults: () => void;
  setCurrentFilePath: (path: string) => void;
  setStatusText: (text: string) => void;
  setFailedCount: (count: number) => void;
  resolveUncensoredResults: (updates: UncensoredConfirmResultItem[]) => void;
  reset: () => void;
}

// 开发环境下启用 HMR 状态持久化
const isDev = import.meta.env.DEV;
const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

// Renderer builds without a path polyfill, so keep this dirname logic local.
const deriveOutputPathFromVideoPath = (videoPath: string): string | undefined => {
  const normalizedPath = videoPath.trim();
  if (!normalizedPath) {
    return undefined;
  }

  const slash = Math.max(normalizedPath.lastIndexOf("/"), normalizedPath.lastIndexOf("\\"));
  if (slash < 0) {
    return undefined;
  }

  if (slash === 0) {
    return normalizedPath[0];
  }

  return normalizedPath.slice(0, slash);
};

const storeCreator: StateCreator<ScrapeState> = (set) => ({
  isScraping: false,
  scrapeStatus: "idle",
  progress: 0,
  total: 0,
  current: 0,
  failedCount: 0,
  results: [],
  currentFilePath: "",
  statusText: "",

  setScraping: (isScraping) => set({ isScraping }),
  setScrapeStatus: (status) => set({ scrapeStatus: status }),
  updateProgress: (current, total) =>
    set({
      current,
      total,
      progress: total > 0 ? (current / total) * 100 : 0,
    }),
  addResult: (result) => set((state) => ({ results: [...state.results, result] })),
  clearResults: () =>
    set({
      results: [],
      failedCount: 0,
      statusText: "",
      currentFilePath: "",
    }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setStatusText: (text) => set({ statusText: text }),
  setFailedCount: (count) => set({ failedCount: Math.max(0, count) }),
  resolveUncensoredResults: (updates) =>
    set((state) => {
      const updateBySourcePath = new Map(updates.map((item) => [item.sourceVideoPath, item]));
      return {
        results: state.results.map((result) => {
          const matched = updateBySourcePath.get(result.path);
          if (!matched) {
            return result;
          }

          return {
            ...result,
            path: matched.targetVideoPath,
            nfoPath: matched.targetNfoPath,
            outputPath: deriveOutputPathFromVideoPath(matched.targetVideoPath),
            uncensoredAmbiguous: false,
          };
        }),
      };
    }),
  reset: () =>
    set({
      isScraping: false,
      scrapeStatus: "idle",
      progress: 0,
      total: 0,
      current: 0,
      failedCount: 0,
      results: [],
      currentFilePath: "",
      statusText: "",
    }),
});

export const useScrapeStore = isDev
  ? create<ScrapeState>()(
      persist(storeCreator, {
        name: "scrape-store",
        storage: createJSONStorage(() => (typeof sessionStorage !== "undefined" ? sessionStorage : noopStorage)),
      }),
    )
  : create<ScrapeState>()(storeCreator);
