import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type RecentAcquisition, RecentAcquisitionsStore } from "@main/services/history/RecentAcquisitionsStore";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dirPath = await mkdtemp(join(tmpdir(), "mdcz-recent-acquisitions-"));
  tempDirs.push(dirPath);
  return dirPath;
};

const readRecords = async (filePath: string): Promise<RecentAcquisition[]> =>
  JSON.parse(await readFile(filePath, "utf8")) as RecentAcquisition[];

describe("RecentAcquisitionsStore", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      tempDirs.splice(0, tempDirs.length).map((dirPath) => rm(dirPath, { recursive: true, force: true })),
    );
  });

  it("records batches, overwrites duplicate numbers, caps at 50, and removes orphan thumbnails", async () => {
    const root = await createTempDir();
    const filePath = join(root, "recent-acquisitions.json");
    const thumbnailDir = join(root, "thumbnails");
    let timestamp = 1_000;
    const store = new RecentAcquisitionsStore({
      filePath,
      thumbnailDir,
      now: () => {
        timestamp += 1;
        return timestamp;
      },
      createThumbnail: async (posterPath) => Buffer.from(`thumb:${posterPath}`),
      logger: { warn: vi.fn() },
    });

    await store.recordBatch([
      {
        number: "A/B:1*",
        title: "old title",
        actors: ["Old Actor"],
        lastKnownPath: "/output/old.mp4",
        posterPath: "old-poster",
      },
    ]);

    await mkdir(thumbnailDir, { recursive: true });
    await writeFile(join(thumbnailDir, "orphan.webp"), "orphan", "utf8");

    await store.recordBatch([
      ...Array.from({ length: 51 }, (_, index) => ({
        number: `N${index}`,
        title: `Title ${index}`,
        actors: [`Actor ${index}`],
        lastKnownPath: `/output/N${index}.mp4`,
        posterPath: `poster-${index}`,
      })),
      {
        number: "A/B:1*",
        title: "new title",
        actors: ["New Actor"],
        lastKnownPath: "/output/new.mp4",
        posterPath: "new-poster",
      },
    ]);

    const records = await readRecords(filePath);
    const numbers = records.map((record) => record.number);

    expect(records).toHaveLength(50);
    expect(numbers).toContain("A/B:1*");
    expect(numbers).toContain("N50");
    expect(numbers).not.toContain("N0");
    expect(numbers).not.toContain("N1");
    expect(records[0]).toMatchObject({
      number: "A/B:1*",
      title: "new title",
      actors: ["New Actor"],
      lastKnownPath: "/output/new.mp4",
    });
    await expect(
      readFile(join(thumbnailDir, `${encodeURIComponent("A/B:1*").replaceAll("*", "%2A")}.webp`), "utf8"),
    ).resolves.toBe("thumb:new-poster");
    await expect(readFile(join(thumbnailDir, "A%2FB%3A1*.webp"), "utf8")).rejects.toThrow();
    await expect(readFile(join(thumbnailDir, "orphan.webp"), "utf8")).rejects.toThrow();
  });

  it("defaults missing persisted actors to an empty list", async () => {
    const root = await createTempDir();
    const filePath = join(root, "recent-acquisitions.json");
    await writeFile(
      filePath,
      JSON.stringify([
        {
          number: "ABC-123",
          title: "Title",
          lastKnownPath: "/output/ABC-123.mp4",
          completedAt: 1_000,
        },
      ]),
      "utf8",
    );

    const store = new RecentAcquisitionsStore({
      filePath,
      thumbnailDir: join(root, "thumbnails"),
      logger: { warn: vi.fn() },
      createThumbnail: async () => Buffer.from("unused"),
    });

    await expect(store.list()).resolves.toEqual([
      {
        number: "ABC-123",
        title: "Title",
        actors: [],
        lastKnownPath: "/output/ABC-123.mp4",
        completedAt: 1_000,
      },
    ]);
  });

  it("returns an empty list and warns when the store file is corrupt", async () => {
    const root = await createTempDir();
    const filePath = join(root, "recent-acquisitions.json");
    const warn = vi.fn();
    await writeFile(filePath, "{not json", "utf8");

    const store = new RecentAcquisitionsStore({
      filePath,
      thumbnailDir: join(root, "thumbnails"),
      logger: { warn },
      createThumbnail: async () => Buffer.from("unused"),
    });

    await expect(store.list()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Corrupt JSON"));
  });
});
