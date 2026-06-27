import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SystemService } from "./systemService";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const serverPackageRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("SystemService", () => {
  it("uses the product version when the server starts from the app package directory", async () => {
    const originalCwd = process.cwd();
    const rootPackage = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")) as { version: string };

    try {
      process.chdir(serverPackageRoot);
      const about = await new SystemService().about();

      expect(about.version).toBe(rootPackage.version);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
