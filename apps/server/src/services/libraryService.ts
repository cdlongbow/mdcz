import { stat } from "node:fs/promises";
import { resolveRootRelativePath } from "@mdcz/media-store";
import type { LibraryEntryRecord } from "@mdcz/persistence";
import {
  createRuntimeLibraryOverview,
  getLatestLibraryEntryTimestamp,
  type RuntimeLibraryEntrySummaryInput,
} from "@mdcz/runtime/library";
import type {
  CrawlerDataDto,
  LibraryDetailResponse,
  LibraryEntryDto,
  LibraryListInput,
  LibraryListResponse,
  OverviewSummaryResponse,
} from "@mdcz/shared/serverDtos";
import type { MediaRootService } from "./mediaRootService";
import type { ServerPersistenceService } from "./persistenceService";

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

export class LibraryService {
  constructor(
    private readonly persistence: ServerPersistenceService,
    private readonly mediaRoots: MediaRootService,
  ) {}

  async list(input: LibraryListInput = {}): Promise<LibraryListResponse> {
    const entries = await this.listDtos(input, true);
    return { entries: entries.entries, total: entries.total };
  }

  async search(input: LibraryListInput = {}): Promise<LibraryListResponse> {
    return await this.list(input);
  }

  async detail(id: string): Promise<LibraryDetailResponse> {
    const state = await this.persistence.getState();
    const entry = await state.repositories.library.getEntryById(id);
    return { entry: await this.toDto(entry, true) };
  }

  async refresh(id: string): Promise<LibraryDetailResponse> {
    const state = await this.persistence.getState();
    const entry = await state.repositories.library.touchEntry(id);
    return { entry: await this.toDto(entry, true) };
  }

  async relink(input: { id: string; rootId: string; relativePath: string }): Promise<LibraryDetailResponse> {
    await this.mediaRoots.getActiveRoot(input.rootId);
    const state = await this.persistence.getState();
    const entry = await state.repositories.library.relinkEntry({
      id: input.id,
      rootId: input.rootId,
      rootRelativePath: input.relativePath,
    });
    return { entry: await this.toDto(entry, true) };
  }

  async removeRecentAcquisition(id: string): Promise<{ success: true }> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error("Library entry id is required");
    }
    const state = await this.persistence.getState();
    await state.repositories.library.hideFromRecent(normalizedId);
    return { success: true };
  }

  async deleteEntry(id: string): Promise<{ success: true }> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error("Library entry id is required");
    }
    const state = await this.persistence.getState();
    await state.repositories.library.deleteEntry(normalizedId);
    return { success: true };
  }

  async overview(): Promise<OverviewSummaryResponse> {
    const state = await this.persistence.getState();
    const [latestOutput, roots, records] = await Promise.all([
      state.repositories.library.latestScrapeOutput(),
      this.mediaRoots.list(),
      state.repositories.library.listEntries(),
    ]);
    const rootMap = new Map(roots.roots.map((root) => [root.id, root]));
    const entries = records.filter((entry) => rootMap.has(entry.rootId));
    const runtimeEntries = entries.map(toRuntimeLibraryEntrySummaryInput);
    const latestEntryTimestamp = getLatestLibraryEntryTimestamp(runtimeEntries);
    const overview = createRuntimeLibraryOverview({
      entries: runtimeEntries,
      latestOutput,
      now: latestEntryTimestamp ?? Date.now(),
      recentLimit: 8,
    });
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    const outputAt = latestOutput ? overview.output.scannedAt : latestEntryTimestamp;
    const recentAcquisitions = await Promise.all(
      overview.recentAcquisitions.map(async (entry) => {
        const record = entryById.get(entry.id ?? "");
        const root = record ? rootMap.get(record.rootId) : undefined;
        return {
          id: entry.id ?? "",
          rootId: record?.rootId ?? "",
          number: entry.number,
          title: entry.title,
          actors: entry.actors,
          thumbnailPath: entry.thumbnailPath ?? null,
          lastKnownPath: entry.lastKnownPath,
          completedAt: new Date(entry.completedAt).toISOString(),
          available: record && root ? await this.checkAvailability(root, record.rootRelativePath) : null,
        };
      }),
    );

    return {
      output: {
        fileCount: overview.output.fileCount,
        totalBytes: overview.output.totalBytes,
        outputAt: outputAt ? new Date(outputAt).toISOString() : null,
        rootPath: overview.output.rootPath,
      },
      recentAcquisitions,
    };
  }

  private async listDtos(input: LibraryListInput = {}, includeAvailability: boolean): Promise<LibraryListResponse> {
    const state = await this.persistence.getState();
    const [roots, records] = await Promise.all([this.mediaRoots.list(), state.repositories.library.listEntries()]);
    const rootMap = new Map(roots.roots.map((root) => [root.id, root]));
    const query = input?.query?.trim().toLowerCase() ?? "";
    const rootId = input?.rootId?.trim();
    const limit = input?.limit ?? 200;

    const filtered = records
      .filter((entry) => !rootId || entry.rootId === rootId || entry.files.some((file) => file.rootId === rootId))
      .filter((entry) => {
        const root = rootMap.get(entry.rootId);
        if (!root) {
          return false;
        }
        if (!query) {
          return true;
        }
        return [
          entry.fileName,
          entry.rootRelativePath,
          root.displayName,
          entry.title,
          entry.number,
          entry.mediaIdentity,
          ...entry.actors,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(query));
      });

    return {
      entries: await Promise.all(filtered.slice(0, limit).map((entry) => this.toDto(entry, includeAvailability))),
      total: filtered.length,
    };
  }

  private async toDto(entry: LibraryEntryRecord, includeAvailability: boolean): Promise<LibraryEntryDto> {
    const roots = await this.mediaRoots.list();
    const rootMap = new Map(roots.roots.map((root) => [root.id, root]));
    const root = rootMap.get(entry.rootId);
    if (!root) {
      throw new Error(`Media root not found: ${entry.rootId}`);
    }
    const available = includeAvailability ? await this.checkAvailability(root, entry.rootRelativePath) : null;
    const fileRefs = await Promise.all(
      entry.files.map(async (file) => {
        const fileRoot = rootMap.get(file.rootId);
        const fileAvailable =
          includeAvailability && fileRoot ? await this.checkAvailability(fileRoot, file.rootRelativePath) : null;
        return {
          id: file.id,
          rootId: file.rootId,
          rootDisplayName: fileRoot?.displayName ?? "未知媒体目录",
          relativePath: file.rootRelativePath,
          fileName: file.fileName,
          directory: file.directory,
          size: file.size,
          modifiedAt: toIso(file.modifiedAt),
          lastKnownPath: file.lastKnownPath,
          available: fileAvailable,
        };
      }),
    );

    return {
      id: entry.id,
      mediaIdentity: entry.mediaIdentity,
      rootId: entry.rootId,
      rootDisplayName: root.displayName,
      relativePath: entry.rootRelativePath,
      fileName: entry.fileName,
      directory: entry.directory,
      size: entry.size,
      modifiedAt: toIso(entry.modifiedAt),
      taskId: entry.sourceTaskId,
      scrapeOutputId: entry.scrapeOutputId,
      title: entry.title,
      number: entry.number,
      actors: entry.actors,
      crawlerData: parseCrawlerData(entry.crawlerDataJson),
      thumbnailPath: entry.thumbnailPath,
      lastKnownPath: entry.lastKnownPath,
      createdAt: entry.createdAt.toISOString(),
      lastRefreshedAt: toIso(entry.lastRefreshedAt),
      hiddenFromRecentAt: toIso(entry.hiddenFromRecentAt),
      available,
      fileRefs,
      assets: entry.assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        uri: asset.uri,
        rootId: asset.rootId,
        relativePath: asset.relativePath,
      })),
    };
  }

  private async checkAvailability(
    root: { hostPath: string; enabled: boolean },
    relativePath: string,
  ): Promise<boolean> {
    if (!root.enabled) {
      return false;
    }
    try {
      const stats = await stat(resolveRootRelativePath(root, relativePath));
      return stats.isFile();
    } catch {
      return false;
    }
  }
}

const parseCrawlerData = (value: string | null): CrawlerDataDto | null => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as CrawlerDataDto;
  } catch {
    return null;
  }
};

const toRuntimeLibraryEntrySummaryInput = (entry: LibraryEntryRecord): RuntimeLibraryEntrySummaryInput => ({
  id: entry.id,
  number: entry.number,
  fileName: entry.fileName,
  title: entry.title,
  actors: entry.actors,
  thumbnailPath: entry.thumbnailPath,
  lastKnownPath: entry.lastKnownPath,
  createdAt: entry.createdAt,
  hiddenFromRecentAt: entry.hiddenFromRecentAt,
  size: entry.size,
});
