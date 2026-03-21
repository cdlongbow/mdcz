import { afterEach, describe, expect, it } from "vitest";
import type { ScrapeResult } from "@/store/scrapeStore";
import { useScrapeStore } from "@/store/scrapeStore";

afterEach(() => {
  useScrapeStore.getState().reset();
});

describe("useScrapeStore.resolveUncensoredResults", () => {
  it("updates matched results and derives output directories from renamed target video paths", () => {
    const results: ScrapeResult[] = [
      {
        id: "unix-item",
        status: "success",
        number: "ABC-123",
        path: "/source/ABC-123.mp4",
        outputPath: "/source",
        nfoPath: "/source/ABC-123.nfo",
        uncensoredAmbiguous: true,
      },
      {
        id: "windows-item",
        status: "success",
        number: "XYZ-789",
        path: "C:\\source\\XYZ-789.mp4",
        outputPath: "C:\\source",
        nfoPath: "C:\\source\\XYZ-789.nfo",
        uncensoredAmbiguous: true,
      },
      {
        id: "untouched-item",
        status: "success",
        number: "KEEP-001",
        path: "/keep/KEEP-001.mp4",
        outputPath: "/keep",
        nfoPath: "/keep/KEEP-001.nfo",
        uncensoredAmbiguous: true,
      },
    ];

    useScrapeStore.setState({ results });
    useScrapeStore.getState().resolveUncensoredResults([
      {
        sourceVideoPath: "/source/ABC-123.mp4",
        sourceNfoPath: "/source/ABC-123.nfo",
        targetVideoPath: "/library/uncensored/ABC-123.mp4",
        targetNfoPath: "/library/uncensored/ABC-123.nfo",
        choice: "uncensored",
      },
      {
        sourceVideoPath: "C:\\source\\XYZ-789.mp4",
        sourceNfoPath: "C:\\source\\XYZ-789.nfo",
        targetVideoPath: "D:\\library\\leak\\XYZ-789.mp4",
        targetNfoPath: "D:\\library\\leak\\XYZ-789.nfo",
        choice: "leak",
      },
    ]);

    expect(useScrapeStore.getState().results).toEqual([
      {
        id: "unix-item",
        status: "success",
        number: "ABC-123",
        path: "/library/uncensored/ABC-123.mp4",
        outputPath: "/library/uncensored",
        nfoPath: "/library/uncensored/ABC-123.nfo",
        uncensoredAmbiguous: false,
      },
      {
        id: "windows-item",
        status: "success",
        number: "XYZ-789",
        path: "D:\\library\\leak\\XYZ-789.mp4",
        outputPath: "D:\\library\\leak",
        nfoPath: "D:\\library\\leak\\XYZ-789.nfo",
        uncensoredAmbiguous: false,
      },
      {
        id: "untouched-item",
        status: "success",
        number: "KEEP-001",
        path: "/keep/KEEP-001.mp4",
        outputPath: "/keep",
        nfoPath: "/keep/KEEP-001.nfo",
        uncensoredAmbiguous: true,
      },
    ]);
  });
});
