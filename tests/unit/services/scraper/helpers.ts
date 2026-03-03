import type { Configuration } from "@main/services/config";
import { ConfigManager } from "@main/services/config/ConfigManager";

const getByPath = (target: Record<string, unknown>, path: string): unknown => {
  let cursor: unknown = target;
  for (const segment of path.split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || !(segment in cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

export class TestConfigManager extends ConfigManager {
  constructor(private readonly config: Configuration) {
    super();
  }

  override async ensureLoaded(): Promise<void> {
    return;
  }

  override async get(path?: string): Promise<Configuration | unknown> {
    if (!path) {
      return this.config;
    }

    return getByPath(this.config as unknown as Record<string, unknown>, path);
  }
}
