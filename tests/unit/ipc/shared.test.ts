import { withIpcErrorHandling } from "@main/ipc/errorHandling";
import { createIpcError, SerializableIpcError } from "@main/ipc/errors";
import { ScraperServiceError } from "@main/services/scraper";
import { describe, expect, it, vi } from "vitest";

describe("withIpcErrorHandling", () => {
  it("maps known service errors without logging", async () => {
    const logger = { error: vi.fn() };

    await expect(
      withIpcErrorHandling(
        "start scraper",
        async () => {
          throw new ScraperServiceError("NO_FILES", "No files selected");
        },
        {
          logger,
          mapError: (error) =>
            error instanceof ScraperServiceError ? createIpcError(error.code, error.message) : undefined,
        },
      ),
    ).rejects.toMatchObject({
      code: "NO_FILES",
      message: "No files selected",
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs and serializes unexpected errors", async () => {
    const logger = { error: vi.fn() };
    let caught: unknown;

    try {
      await withIpcErrorHandling(
        "start scraper",
        async () => {
          throw new Error("boom");
        },
        { logger },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SerializableIpcError);
    expect(caught).toMatchObject({
      code: "Error",
      message: "boom",
    });

    expect(logger.error).toHaveBeenCalledWith("Failed to start scraper: boom");
  });

  it("passes through ipc errors without extra logging", async () => {
    const logger = { error: vi.fn() };
    const error = createIpcError("INVALID_ARGUMENT", "bad input");

    await expect(
      withIpcErrorHandling(
        "confirm uncensored items",
        async () => {
          throw error;
        },
        { logger },
      ),
    ).rejects.toBe(error);

    expect(logger.error).not.toHaveBeenCalled();
  });
});
