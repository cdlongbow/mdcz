import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PosterImageDerivationService,
  resolveThumbToPosterCropRegion,
} from "@mdcz/runtime/scrape/download/assets/PosterImageDerivationService";
import { validateImage } from "@mdcz/runtime/scrape/utils/image";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dirPath = await mkdtemp(join(tmpdir(), "mdcz-poster-derivation-"));
  tempDirs.push(dirPath);
  return dirPath;
};

const writeSvgImage = async (filePath: string, width: number, height: number, fill = "#7799cc"): Promise<void> => {
  await writeFile(
    filePath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`,
    "utf8",
  );
};

const writeLargeSvgImage = async (filePath: string, width: number, height: number): Promise<void> => {
  await writeFile(
    filePath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><metadata>${"x".repeat(
      55_000,
    )}</metadata><rect width="100%" height="100%" fill="#445577"/></svg>`,
    "utf8",
  );
};

const writeSmallPoster = async (filePath: string): Promise<void> => {
  await writeSvgImage(filePath, 147, 200);
};

const createSubject = () => {
  const logger = { warn: vi.fn() };
  return {
    logger,
    service: new PosterImageDerivationService(logger),
  };
};

describe("PosterImageDerivationService", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0, tempDirs.length).map(async (dirPath) => {
        await rm(dirPath, { recursive: true, force: true });
      }),
    );
  });

  it("uses the DMM landscape right crop for 800x538 thumbs", async () => {
    const root = await createTempDir();
    const thumbPath = join(root, "thumb.jpg");
    const posterPath = join(root, "poster.jpg");
    await writeSvgImage(thumbPath, 800, 538, "#445577");
    await writeSmallPoster(posterPath);

    const { service } = createSubject();
    const result = await service.deriveFromThumbIfNeeded({
      posterPath,
      targetPath: posterPath,
      thumbPath,
    });

    expect(result).toEqual({ status: "derived", path: posterPath });
    await expect(validateImage(posterPath, 0)).resolves.toMatchObject({
      valid: true,
      width: 379,
      height: 538,
    });
  });

  it("uses a centered crop for near-square thumbs", async () => {
    const root = await createTempDir();
    const thumbPath = join(root, "thumb.jpg");
    const posterPath = join(root, "poster.jpg");
    await writeSvgImage(thumbPath, 600, 720, "#445577");
    await writeSmallPoster(posterPath);

    const { service } = createSubject();
    await expect(
      service.deriveFromThumbIfNeeded({
        posterPath,
        targetPath: posterPath,
        thumbPath,
      }),
    ).resolves.toEqual({ status: "derived", path: posterPath });

    await expect(validateImage(posterPath, 0)).resolves.toMatchObject({
      valid: true,
      width: 480,
      height: 720,
    });
  });

  it("skips portrait thumbs without changing an existing poster", async () => {
    const root = await createTempDir();
    const thumbPath = join(root, "thumb.jpg");
    const posterPath = join(root, "poster.jpg");
    await writeSvgImage(thumbPath, 200, 300, "#445577");
    await writeSmallPoster(posterPath);
    const before = await readFile(posterPath);

    const { service } = createSubject();
    await expect(
      service.deriveFromThumbIfNeeded({
        posterPath,
        targetPath: posterPath,
        thumbPath,
      }),
    ).resolves.toEqual({ status: "skipped", reason: "portrait_thumb" });

    await expect(readFile(posterPath)).resolves.toEqual(before);
  });

  it("skips posters at or above the size threshold byte-for-byte", async () => {
    const root = await createTempDir();
    const thumbPath = join(root, "thumb.jpg");
    const posterPath = join(root, "poster.jpg");
    await writeSvgImage(thumbPath, 800, 538, "#445577");
    await writeLargeSvgImage(posterPath, 400, 700);
    expect((await stat(posterPath)).size).toBeGreaterThanOrEqual(50_000);
    const before = await readFile(posterPath);

    const { service } = createSubject();
    await expect(
      service.deriveFromThumbIfNeeded({
        posterPath,
        targetPath: posterPath,
        thumbPath,
      }),
    ).resolves.toEqual({ status: "skipped", reason: "large_poster" });

    await expect(readFile(posterPath)).resolves.toEqual(before);
  });

  it("skips missing thumbs without throwing", async () => {
    const root = await createTempDir();
    const posterPath = join(root, "poster.jpg");
    await writeSmallPoster(posterPath);

    const { logger, service } = createSubject();
    await expect(
      service.deriveFromThumbIfNeeded({
        posterPath,
        targetPath: posterPath,
        thumbPath: undefined,
      }),
    ).resolves.toEqual({ status: "skipped", reason: "missing_thumb" });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("thumb asset is missing"));
  });

  it("documents the special right-crop dimensions", () => {
    expect(resolveThumbToPosterCropRegion(840, 472)).toEqual({
      left: 473,
      top: 0,
      width: 315,
      height: 472,
    });
  });
});
