import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loggerService } from "@main/services/LoggerService";
import type { ScrapeResult, ScraperStatus } from "@shared/types";
import { app } from "electron";
import PQueue from "p-queue";

type SessionState = "idle" | "running" | "stopping" | "paused";

interface QueueTask {
  sourcePath: string;
  fileIndex: number;
  totalFiles: number;
  isRetry: boolean;
  taskFn: (signal: AbortSignal) => Promise<ScrapeResult>;
}

interface PersistedState {
  taskId: string;
  status: ScraperStatus;
  failedFiles: string[];
  pendingFiles: string[];
}

export interface RecoverableSessionSnapshot {
  taskId: string;
  status: ScraperStatus;
  failedFiles: string[];
  pendingFiles: string[];
}

const defaultStatus = (): ScraperStatus => ({
  state: "idle",
  running: false,
  totalFiles: 0,
  completedFiles: 0,
  successCount: 0,
  failedCount: 0,
  skippedCount: 0,
});

const getStatePath = (): string => {
  try {
    return join(app.getPath("userData"), "session-state.json");
  } catch {
    return join(process.cwd(), ".tmp", "session-state.json");
  }
};

export class ScrapeSession {
  private readonly logger = loggerService.getLogger("ScrapeSession");

  private readonly statePath = getStatePath();

  private queue: PQueue | null = null;

  private state: SessionState = "idle";

  private taskId: string | null = null;

  private status: ScraperStatus = defaultStatus();

  private readonly failedFiles = new Set<string>();

  private readonly retryingFiles = new Set<string>();

  private readonly pendingFiles = new Set<string>();

  private stopRequested = false;

  private controller: AbortController | null = null;

  private dirty = false;

  private persistTimer: NodeJS.Timeout | null = null;

  getStatus(): ScraperStatus {
    return this.status;
  }

  getState(): SessionState {
    return this.state;
  }

  getTaskId(): string | null {
    return this.taskId;
  }

  getFailedFiles(): string[] {
    return Array.from(this.failedFiles);
  }

  getSignal(): AbortSignal {
    if (!this.controller) {
      throw new Error("Scrape session is not active");
    }
    return this.controller.signal;
  }

  async hasRecoverableSession(): Promise<boolean> {
    const snapshot = await this.readPersistedState();
    if (!snapshot || !snapshot.status.running) {
      return false;
    }

    return snapshot.pendingFiles.length > 0 || snapshot.failedFiles.length > 0;
  }

  async getRecoverableSnapshot(): Promise<RecoverableSessionSnapshot | null> {
    const snapshot = await this.readPersistedState();
    if (!snapshot || !snapshot.status.running) {
      return null;
    }

    return snapshot;
  }

  begin(files: string[], concurrency: number): string {
    if (this.state !== "idle") {
      throw new Error("Scrape session is already active");
    }

    this.taskId = randomUUID();
    this.state = "running";
    this.stopRequested = false;
    this.controller = new AbortController();
    this.queue = new PQueue({ concurrency: Math.max(1, concurrency) });
    this.status = {
      state: "running",
      running: true,
      totalFiles: files.length,
      completedFiles: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
    };

    this.failedFiles.clear();
    this.retryingFiles.clear();
    this.pendingFiles.clear();
    for (const file of files) {
      this.pendingFiles.add(file);
    }

    this.startPersistLoop();
    this.markDirty();

    return this.taskId;
  }

  addTask(task: QueueTask): void {
    if (!this.queue || !this.controller) {
      throw new Error("Scrape session is not active");
    }

    const signal = this.controller.signal;

    if (task.isRetry) {
      this.retryingFiles.add(task.sourcePath);
      this.pendingFiles.add(task.sourcePath);
      this.markDirty();
    }

    this.queue.add(async () => {
      if (this.stopRequested) {
        this.retryingFiles.delete(task.sourcePath);
        this.pendingFiles.delete(task.sourcePath);
        this.markDirty();
        return;
      }

      const result = await task.taskFn(signal);
      this.pendingFiles.delete(task.sourcePath);
      this.applyResult(task.sourcePath, result, task.isRetry);
    });
  }

  async onIdle(): Promise<void> {
    if (!this.queue) {
      return;
    }
    await this.queue.onIdle();
  }

  stop(): { pendingCount: number } {
    if (!this.queue || !this.status.running) {
      return { pendingCount: 0 };
    }

    if (this.state !== "stopping") {
      this.state = "stopping";
      this.status = {
        ...this.status,
        state: "stopping",
      };
      this.stopRequested = true;
      this.controller?.abort();
      this.markDirty();
    }

    const pendingCount = this.queue.size;
    this.queue.clear();
    for (const file of this.pendingFiles) {
      if (!this.retryingFiles.has(file)) {
        continue;
      }
      this.retryingFiles.delete(file);
    }
    this.markDirty();

    return { pendingCount };
  }

  pause(): void {
    if (!this.queue || this.state !== "running") {
      return;
    }
    this.queue.pause();
    this.state = "paused";
    this.status = {
      ...this.status,
      state: "paused",
    };
    this.markDirty();
  }

  resume(): void {
    if (!this.queue || this.state !== "paused") {
      return;
    }
    this.queue.start();
    this.state = "running";
    this.status = {
      ...this.status,
      state: "running",
    };
    this.markDirty();
  }

  async finish(): Promise<void> {
    if (!this.status.running && this.state === "idle") {
      return;
    }

    this.status = {
      ...this.status,
      state: "idle",
      running: false,
    };

    this.state = "idle";
    this.taskId = null;
    this.queue = null;
    this.stopRequested = false;
    this.controller = null;
    this.retryingFiles.clear();
    this.pendingFiles.clear();
    this.stopPersistLoop();
    await rm(this.statePath, { force: true }).catch(() => undefined);
  }

  private applyResult(sourcePath: string, result: ScrapeResult, isRetry: boolean): void {
    const hadFailureBefore = this.failedFiles.has(sourcePath);

    if (isRetry) {
      this.retryingFiles.delete(sourcePath);

      if (result.status === "success") {
        this.status.successCount += 1;
        this.status.failedCount = Math.max(0, this.status.failedCount - 1);
        this.failedFiles.delete(sourcePath);
      } else if (result.status === "failed") {
        this.failedFiles.add(sourcePath);
      } else {
        this.status.skippedCount += 1;
        this.status.failedCount = Math.max(0, this.status.failedCount - 1);
        this.failedFiles.delete(sourcePath);
      }

      const failureSetChanged = hadFailureBefore !== this.failedFiles.has(sourcePath);
      this.markDirty();
      if (failureSetChanged) {
        void this.flushNow();
      }
      return;
    }

    this.status = {
      ...this.status,
      completedFiles: this.status.completedFiles + 1,
    };

    if (result.status === "success") {
      this.status.successCount += 1;
      this.failedFiles.delete(sourcePath);
    } else if (result.status === "failed") {
      this.status.failedCount += 1;
      this.failedFiles.add(sourcePath);
    } else {
      this.status.skippedCount += 1;
      this.failedFiles.delete(sourcePath);
    }

    const failureSetChanged = hadFailureBefore !== this.failedFiles.has(sourcePath);
    this.markDirty();
    if (failureSetChanged) {
      void this.flushNow();
    }
  }

  private startPersistLoop(): void {
    this.stopPersistLoop();
    this.persistTimer = setInterval(() => {
      void this.flushDirty();
    }, 2000);
  }

  private stopPersistLoop(): void {
    if (!this.persistTimer) {
      return;
    }
    clearInterval(this.persistTimer);
    this.persistTimer = null;
    this.dirty = false;
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private async flushDirty(): Promise<void> {
    if (!this.dirty) {
      return;
    }
    await this.flushNow();
  }

  private async flushNow(): Promise<void> {
    if (!this.taskId || !this.status.running) {
      return;
    }

    const snapshot: PersistedState = {
      taskId: this.taskId,
      status: this.status,
      failedFiles: Array.from(this.failedFiles),
      pendingFiles: Array.from(this.pendingFiles),
    };

    this.dirty = false;

    try {
      await mkdir(dirname(this.statePath), { recursive: true });
      await writeFile(this.statePath, JSON.stringify(snapshot, null, 2), "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to persist scrape session state: ${message}`);
    }
  }

  private async readPersistedState(): Promise<PersistedState | null> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistedState>;

      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.taskId !== "string" ||
        !parsed.status ||
        typeof parsed.status !== "object" ||
        !Array.isArray(parsed.failedFiles) ||
        !Array.isArray(parsed.pendingFiles)
      ) {
        return null;
      }

      return {
        taskId: parsed.taskId,
        status: {
          ...defaultStatus(),
          ...(parsed.status as Partial<ScraperStatus>),
          state:
            parsed.status.state === "running" || parsed.status.state === "stopping" || parsed.status.state === "paused"
              ? parsed.status.state
              : parsed.status.running
                ? "running"
                : "idle",
        },
        failedFiles: parsed.failedFiles.filter((value): value is string => typeof value === "string"),
        pendingFiles: parsed.pendingFiles.filter((value): value is string => typeof value === "string"),
      };
    } catch {
      return null;
    }
  }
}
