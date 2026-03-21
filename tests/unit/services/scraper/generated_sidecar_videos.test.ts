import { isGeneratedSidecarVideo } from "@main/services/scraper/generatedSidecarVideos";
import { describe, expect, it } from "vitest";

describe("generatedSidecarVideos", () => {
  it("recognizes FC2 gift videos as generated sidecars", () => {
    expect(isGeneratedSidecarVideo("FC2-123456_gift.mp4")).toBe(true);
  });
});
