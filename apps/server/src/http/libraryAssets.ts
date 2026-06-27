import path from "node:path";
import { normalizeRootRelativePath, readRootFile, StorageError, storageErrorCodes } from "@mdcz/media-store";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerServices } from "../services";
import { getBearerToken } from "./auth";

const imageContentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const toStatusCode = (error: unknown): number => {
  if (error instanceof StorageError) {
    if (error.code === storageErrorCodes.MissingPath) {
      return 404;
    }
    if (error.code === storageErrorCodes.PermissionDenied) {
      return 403;
    }
    if (error.code === storageErrorCodes.OutsideRoot) {
      return 400;
    }
  }
  return 500;
};

const sendError = (reply: FastifyReply, statusCode: number, message: string): FastifyReply =>
  reply.code(statusCode).send({ error: { message } });

export const registerLibraryAssets = (fastify: FastifyInstance, services: ServerServices): void => {
  fastify.get("/api/library/assets/:rootId/*", async (request: FastifyRequest, reply) => {
    try {
      services.auth.assertAuthenticated(getBearerToken(request));
    } catch (error) {
      return sendError(reply, 401, error instanceof Error ? error.message : "Authentication required");
    }

    const params = request.params as { "*": string; rootId: string };
    let relativePath: string;
    try {
      relativePath = normalizeRootRelativePath(params["*"]);
    } catch (error) {
      return sendError(reply, toStatusCode(error), error instanceof Error ? error.message : "Invalid asset path");
    }

    const extension = path.extname(relativePath).toLowerCase();
    const contentType = imageContentTypes[extension];
    if (!contentType) {
      return sendError(reply, 415, "Unsupported library asset type");
    }

    try {
      const root = await services.mediaRoots.getActiveRoot(params.rootId);
      const content = await readRootFile(root, relativePath);
      reply.type(contentType);
      reply.header("cache-control", "private, max-age=3600");
      return content;
    } catch (error) {
      return sendError(reply, toStatusCode(error), error instanceof Error ? error.message : "Failed to read asset");
    }
  });
};
