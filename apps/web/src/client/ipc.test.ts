import { Website } from "@mdcz/shared/enums";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../client";
import { ipc } from "./ipc";

describe("web ipc settings adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates settings parity actions to server APIs", async () => {
    vi.spyOn(api.app, "ensureWatermarkDirectory").mockResolvedValue({ path: "/srv/mdcz/data/watermark" });
    vi.spyOn(api.crawler, "listSites").mockResolvedValue({
      sites: [{ site: Website.JAVDB, name: "javdb", enabled: true, native: true }],
    });
    const probeSpy = vi.spyOn(api.crawler, "probeSiteConnectivity").mockResolvedValue({
      ok: true,
      message: "HTTP 200",
      latencyMs: 10,
      status: 200,
      resolvedUrl: "https://javdb.com/",
    });
    vi.spyOn(api.network, "checkCookies").mockResolvedValue({
      results: [{ site: "JavDB", valid: true, message: "Cookie 有效" }],
    });
    const llmSpy = vi.spyOn(api.translate, "testLlm").mockResolvedValue({
      success: true,
      message: "连接成功",
    });

    await expect(ipc.app.ensureWatermarkDirectory()).resolves.toEqual({ path: "/srv/mdcz/data/watermark" });
    await expect(ipc.crawler.listSites()).resolves.toEqual({
      sites: [{ site: Website.JAVDB, name: "javdb", enabled: true, native: true }],
    });
    await expect(ipc.crawler.probeSiteConnectivity(Website.JAVDB)).resolves.toMatchObject({ ok: true, status: 200 });
    await expect(ipc.network.checkCookies()).resolves.toEqual({
      results: [{ site: "JavDB", valid: true, message: "Cookie 有效" }],
    });
    await expect(ipc.translate.testLlm({ llmModelName: "gpt-test" })).resolves.toEqual({
      success: true,
      message: "连接成功",
    });

    expect(probeSpy).toHaveBeenCalledWith({ site: Website.JAVDB });
    expect(llmSpy).toHaveBeenCalledWith({ llmModelName: "gpt-test" });
  });

  it("copies the server watermark path instead of pretending to open a browser host folder", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(api.app, "ensureWatermarkDirectory").mockResolvedValue({ path: "/srv/mdcz/data/watermark" });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await expect(ipc.app.openWatermarkDirectory()).resolves.toMatchObject({
      copied: true,
      path: "/srv/mdcz/data/watermark",
      unsupported: true,
    });
    expect(writeText).toHaveBeenCalledWith("/srv/mdcz/data/watermark");
  });
});
