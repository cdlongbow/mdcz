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

describe("useScrapeStore.addResult", () => {
  it("groups multipart successes that share the same output directory", () => {
    const store = useScrapeStore.getState();

    store.addResult({
      id: "part-1",
      status: "success",
      number: "FC2-123456",
      title: "Multipart Title",
      path: "/library/FC2-123456/FC2-123456-cd1.mp4",
      outputPath: "/library/FC2-123456",
      nfoPath: "/library/FC2-123456/FC2-123456.nfo",
      sceneImages: ["/library/FC2-123456/extrafanart/fanart1.jpg"],
    });
    store.addResult({
      id: "part-2",
      status: "success",
      number: "FC2-123456",
      title: "Multipart Title",
      path: "/library/FC2-123456/FC2-123456-cd2.mp4",
      outputPath: "/library/FC2-123456",
      nfoPath: "/library/FC2-123456/FC2-123456.nfo",
      sceneImages: ["/library/FC2-123456/extrafanart/fanart1.jpg", "/library/FC2-123456/extrafanart/fanart2.jpg"],
    });

    expect(useScrapeStore.getState().results).toEqual([
      {
        id: "part-1",
        status: "success",
        number: "FC2-123456",
        title: "Multipart Title",
        path: "/library/FC2-123456/FC2-123456-cd1.mp4",
        outputPath: "/library/FC2-123456",
        nfoPath: "/library/FC2-123456/FC2-123456.nfo",
        sceneImages: ["/library/FC2-123456/extrafanart/fanart1.jpg", "/library/FC2-123456/extrafanart/fanart2.jpg"],
      },
    ]);
  });
});
