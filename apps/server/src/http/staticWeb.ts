import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};

export const defaultWebStaticDir = (): string => {
  if (process.env.MDCZ_WEB_DIST_DIR) {
    return path.resolve(process.env.MDCZ_WEB_DIST_DIR);
  }

  const candidates = [path.resolve("apps/server/dist/web"), path.resolve("dist/web"), path.resolve("web")];
  return candidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? path.resolve("dist/web");
};

const isPathInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const isReadableFile = (candidate: string): boolean => {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
};

export const registerStaticWeb = (fastify: FastifyInstance, webStaticDir: string): void => {
  const staticRoot = path.resolve(webStaticDir);
  fastify.get("/*", async (request, reply) => {
    const rawPath = request.url.split("?")[0] ?? "/";
    const decodedPath = decodeURIComponent(rawPath);
    const candidate = path.resolve(staticRoot, decodedPath.replace(/^\/+/u, ""));
    const filePath =
      isPathInside(staticRoot, candidate) && isReadableFile(candidate)
        ? candidate
        : path.join(staticRoot, "index.html");
    const extension = path.extname(filePath);
    reply.type(contentTypes[extension] ?? "application/octet-stream");
    return await readFile(filePath);
  });
};
