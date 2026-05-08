import { describe, expect, it, vi } from "vitest";
import { api } from "../client";
import { createWebScrapeActionPort } from "./ports";

describe("web scrape action port", () => {
  it("enables file deletion only for root-relative targets and calls safe server delete", async () => {
    const deleteFile = vi.spyOn(api.scrape, "deleteFile").mockResolvedValue({
      ok: true,
      rootId: "root-1",
      relativePath: "ABC-001.mp4",
    });
    const port = createWebScrapeActionPort();
    const safeTargets = [
      { filePath: "ABC-001.mp4", ref: { rootId: "root-1", relativePath: "ABC-001.mp4" } },
      { filePath: "ABC-001-CD2.mp4", ref: { rootId: "root-1", relativePath: "ABC-001-CD2.mp4" } },
    ];

    expect(port.getDeleteFileAvailability?.([{ filePath: "/absolute/ABC-001.mp4" }])).toBe("hidden");
    expect(port.getDeleteFileAvailability?.(safeTargets)).toBe("enabled");

    await port.deleteFile(safeTargets);

    expect(deleteFile).toHaveBeenNthCalledWith(1, { rootId: "root-1", relativePath: "ABC-001.mp4" });
    expect(deleteFile).toHaveBeenNthCalledWith(2, { rootId: "root-1", relativePath: "ABC-001-CD2.mp4" });
  });

  it("rejects delete calls when any target lacks a root-relative ref", async () => {
    const port = createWebScrapeActionPort();

    await expect(
      port.deleteFile([
        { filePath: "ABC-001.mp4", ref: { rootId: "root-1", relativePath: "ABC-001.mp4" } },
        { filePath: "/absolute/ABC-001-CD2.mp4" },
      ]),
    ).rejects.toThrow("Web 删除文件需要媒体目录引用");
  });
});
