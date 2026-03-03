import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockUserDataPath = "";

vi.mock("electron", () => {
  return {
    app: {
      isReady: () => false,
      isPackaged: false,
      getAppPath: () => "/tmp/app",
      getPath: (name: string) => {
        if (name === "userData") {
          return mockUserDataPath;
        }
        throw new Error(`Unsupported app path: ${name}`);
      },
      commandLine: {
        appendSwitch: () => {},
      },
      setAppUserModelId: () => {},
    },
  };
});

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await readFile(path, "utf8");
    return true;
  } catch {
    return false;
  }
};

describe("ConfigManager configDirectory", () => {
  beforeEach(async () => {
    mockUserDataPath = await mkdtemp(join(tmpdir(), "config-manager-"));
    await mkdir(mockUserDataPath, { recursive: true });
    vi.resetModules();
  });

  it("applies paths.configDirectory immediately and keeps it after reload", async () => {
    const { ConfigManager } = await import("@main/services/config/ConfigManager");

    const manager = new ConfigManager();
    await manager.save({
      paths: {
        configDirectory: "custom-config",
      },
    });

    const expectedConfigPath = join(mockUserDataPath, "custom-config", "default.json");
    const expectedMetaPath = join(mockUserDataPath, ".config-directory.json");

    expect(await fileExists(expectedConfigPath)).toBe(true);
    expect(await fileExists(expectedMetaPath)).toBe(true);

    const reloaded = new ConfigManager();
    const configuration = (await reloaded.get()) as { paths: { configDirectory: string } };
    expect(configuration.paths.configDirectory).toBe("custom-config");
    expect(reloaded.list().dataDir).toBe(join(mockUserDataPath, "custom-config"));
  });
});
