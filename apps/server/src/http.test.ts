import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createHealthPayload } from "./http/health";
import { defaultWebStaticDir } from "./http/staticWeb";

const expectedHealthPayload = {
  service: "mdcz-server",
  status: "ok",
  slice: "app-skeleton",
} as const;

describe("createHealthPayload", () => {
  it("returns the server skeleton health contract", () => {
    expect(createHealthPayload()).toEqual(expectedHealthPayload);
  });
});

describe("defaultWebStaticDir", () => {
  const originalCwd = process.cwd();
  const originalWebDistDir = process.env.MDCZ_WEB_DIST_DIR;

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalWebDistDir === undefined) {
      delete process.env.MDCZ_WEB_DIST_DIR;
    } else {
      process.env.MDCZ_WEB_DIST_DIR = originalWebDistDir;
    }
  });

  it("prefers the explicit MDCZ_WEB_DIST_DIR", () => {
    process.env.MDCZ_WEB_DIST_DIR = "custom-web";

    expect(defaultWebStaticDir()).toBe(resolve(originalCwd, "custom-web"));
  });

  it("finds the server WebUI dist when started from the repository root", async () => {
    const root = await mkdtemp(join(tmpdir(), "mdcz-default-web-"));
    const webRoot = join(root, "apps/server/dist/web");
    delete process.env.MDCZ_WEB_DIST_DIR;
    await mkdir(webRoot, { recursive: true });
    await writeFile(join(webRoot, "index.html"), "<!doctype html>", "utf8");
    process.chdir(root);

    expect(defaultWebStaticDir()).toBe(webRoot);
  });
});
