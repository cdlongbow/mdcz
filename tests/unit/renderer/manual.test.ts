import { Website } from "@shared/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNfoReadCandidates, readNfo } from "@/api/manual";
import { ipc } from "@/client/ipc";

vi.mock("@/client/ipc", () => ({
  ipc: {
    file: {
      nfoRead: vi.fn(),
      nfoWrite: vi.fn(),
    },
  },
}));

describe("buildNfoReadCandidates", () => {
  it("prefers basename nfo before movie.nfo for video paths", () => {
    expect(buildNfoReadCandidates("/media/ABC-123.mp4")).toEqual(["/media/ABC-123.nfo", "/media/movie.nfo"]);
  });

  it("keeps the current separator style for windows paths", () => {
    expect(buildNfoReadCandidates("C:\\media\\ABC-123.mp4")).toEqual([
      "C:\\media\\ABC-123.nfo",
      "C:\\media\\movie.nfo",
    ]);
  });

  it("does not add duplicate fallbacks for movie.nfo itself", () => {
    expect(buildNfoReadCandidates("/media/movie.nfo")).toEqual(["/media/movie.nfo"]);
  });
});

describe("readNfo", () => {
  const nfoRead = vi.mocked(ipc.file.nfoRead);
  const crawlerData = {
    title: "Movie Title",
    number: "ABC-123",
    actors: [],
    genres: [],
    sample_images: [],
    website: Website.DMM,
  };

  beforeEach(() => {
    nfoRead.mockReset();
  });

  it("falls back to movie.nfo only when the primary nfo is missing", async () => {
    nfoRead
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOENT" }))
      .mockResolvedValueOnce({ data: crawlerData });

    await expect(readNfo("/media/ABC-123.mp4")).resolves.toEqual({
      data: {
        path: "/media/movie.nfo",
        content: JSON.stringify(crawlerData, null, 2),
      },
    });

    expect(nfoRead).toHaveBeenNthCalledWith(1, "/media/ABC-123.nfo");
    expect(nfoRead).toHaveBeenNthCalledWith(2, "/media/movie.nfo");
  });

  it("does not hide real nfo parsing errors behind the movie.nfo fallback", async () => {
    nfoRead.mockRejectedValueOnce(Object.assign(new Error("invalid nfo"), { code: "PARSE_ERROR" }));

    await expect(readNfo("/media/ABC-123.mp4")).rejects.toMatchObject({
      message: "invalid nfo",
      code: "PARSE_ERROR",
    });
    expect(nfoRead).toHaveBeenCalledTimes(1);
  });
});
